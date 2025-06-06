import Button from "@components/Button";
import FancyToggleSwitch from "@components/FancyToggleSwitch";
import HelpText from "@components/HelpText";
import InlineLink from "@components/InlineLink";
import { Input } from "@components/Input";
import { Label } from "@components/Label";
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalFooter,
  ModalTrigger,
} from "@components/modal/Modal";
import ModalHeader from "@components/modal/ModalHeader";
import { notify } from "@components/Notification";
import Paragraph from "@components/Paragraph";
import { PeerGroupSelector } from "@components/PeerGroupSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/Tabs";
import { Textarea } from "@components/Textarea";
import InputDomain, { domainReducer } from "@components/ui/InputDomain";
import { useApiCall } from "@utils/api";
import { cn } from "@utils/helpers";
import cidr from "ip-cidr";
import { uniqueId } from "lodash";
import {
  ExternalLinkIcon,
  GlobeIcon,
  MinusCircleIcon,
  PlusCircle,
  PlusIcon,
  Power,
  Scan,
  ServerIcon,
  Text,
} from "lucide-react";
import React, { useEffect, useMemo, useReducer, useState } from "react";
import { useSWRConfig } from "swr";
import DNSIcon from "@/assets/icons/DNSIcon";
import { usePermissions } from "@/contexts/PermissionsProvider";
import { Nameserver, NameserverGroup } from "@/interfaces/Nameserver";
import useGroupHelper from "@/modules/groups/useGroupHelper";

type Props = {
  children?: React.ReactNode;
  preset?: NameserverGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cell?: string;
};

export default function NameserverModal({
  children,
  preset,
  open,
  onOpenChange,
  cell,
}: Readonly<Props>) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} key={open ? 1 : 0}>
      {children && <ModalTrigger asChild>{children}</ModalTrigger>}
      {open && (
        <NameserverModalContent
          onSuccess={() => onOpenChange(false)}
          preset={preset}
          cell={cell}
        />
      )}
    </Modal>
  );
}

type ModalProps = {
  onSuccess?: () => void;
  preset?: NameserverGroup;
  cell?: string;
};

export const nameServerReducer = (state: Nameserver[], action: any) => {
  switch (action.type) {
    case ActionType.ADD:
      return [
        ...state,
        { ip: "", port: 53, ns_type: "udp", id: uniqueId("ns") },
      ];
    case ActionType.REMOVE:
      return state.filter((_, i) => i !== action.index);
    case ActionType.UPDATE:
      return state.map((n, i) => (i === action.index ? action.ns : n));
    default:
      return state;
  }
};

enum ActionType {
  ADD = "ADD",
  REMOVE = "REMOVE",
  UPDATE = "UPDATE",
}

export function NameserverModalContent({
  onSuccess,
  preset,
  cell,
}: Readonly<ModalProps>) {
  const { permission } = usePermissions();
  const nsRequest = useApiCall<NameserverGroup>("/dns/nameservers", true);
  const { mutate } = useSWRConfig();

  const isUpdate = useMemo(() => {
    return !!(preset && preset.id !== undefined);
  }, [preset]);

  const update = async (groupIds: string[]) => {
    notify({
      title: "Update Nameserver",
      description: "Nameserver was updated successfully.",
      loadingMessage: "Updating your nameserver...",
      promise: nsRequest
        .put(
          {
            name: name,
            description: description,
            nameservers: nameservers.map(({ id, ...item }) => item),
            enabled: enabled,
            groups: groupIds,
            primary: !domains.length,
            domains: domains.map(({ id, ...item }) => item.name),
            search_domains_enabled: !domains.length ? false : matchDomains,
          },
          `/${preset?.id}`,
        )
        .then(() => {
          onSuccess && onSuccess();
          mutate("/dns/nameservers");
        }),
    });
  };

  const create = async (groupIds: string[]) => {
    notify({
      title: "Create Nameserver",
      description: "Nameserver was created successfully.",
      loadingMessage: "Creating your nameserver...",
      promise: nsRequest
        .post({
          name: name,
          description: description,
          nameservers: nameservers.map(({ id, ...item }) => item),
          enabled: enabled,
          groups: groupIds,
          primary: !domains.length,
          domains: domains.map(({ id, ...item }) => item.name),
          search_domains_enabled: !domains.length ? false : matchDomains,
        })
        .then(() => {
          onSuccess && onSuccess();
          mutate("/dns/nameservers");
        }),
    });
  };

  const submit = async () => {
    const groups = await saveGroups();
    const groupIds = groups.map((g) => g.id) as string[];

    if (isUpdate) {
      await update(groupIds);
    } else {
      await create(groupIds);
    }
  };

  // Nameservers
  const [nameservers, setNameservers] = useReducer(nameServerReducer, [], () =>
    preset?.nameservers
      ? preset.nameservers.map((ns) => ({ id: uniqueId("ns"), ...ns }))
      : [],
  );

  const [groups, setGroups, { save: saveGroups }] = useGroupHelper({
    initial: preset?.groups || [],
  });
  const [enabled, setEnabled] = useState<boolean>(
    typeof preset?.enabled !== undefined && preset ? preset.enabled : true,
  );

  // Domains
  const [domains, setDomains] = useReducer(domainReducer, [], () => {
    if (preset?.domains?.length) {
      return preset.domains.map((d) => ({ name: d, id: uniqueId("domain") }));
    }
    return [];
  });
  const [matchDomains, setMatchDomains] = useState<boolean>(
    typeof preset?.search_domains_enabled !== undefined && preset
      ? preset.search_domains_enabled
      : false,
  );

  // General
  const [name, setName] = useState(preset?.name || "");
  const [description, setDescription] = useState(preset?.description || "");
  const [tab, setTab] = useState(
    cell && cell == "name"
      ? "general"
      : cell == "domains"
      ? "domains"
      : "nameserver",
  );

  const [nsError, setNsError] = useState<boolean>(false);
  const [domainError, setDomainError] = useState<boolean>(false);

  const hasNSErrors = useMemo(() => {
    if (nameservers.length < 1) return true;
    return nameservers.some((ns) => ns.ip === "");
  }, [nameservers]);

  const hasDomainErrors = useMemo(() => {
    if (domains.length === 0) return false;
    return domains.some((d) => d.name === "");
  }, [domains]);

  const nameLengthError = useMemo(() => {
    if (name.length > 40) return "Name should be less than 40 characters";
    return "";
  }, [name]);

  const canContinueToDomains = useMemo(() => {
    return !(
      hasNSErrors ||
      nsError ||
      nameservers.length == 0 ||
      groups.length == 0
    );
  }, [hasNSErrors, nsError, nameservers.length, groups.length]);

  const canContinueToGeneral = useMemo(() => {
    return !(!canContinueToDomains || domainError || hasDomainErrors);
  }, [canContinueToDomains, domainError, hasDomainErrors]);

  const canSubmit = useMemo(() => {
    return !(!canContinueToGeneral || nameLengthError !== "" || name == "");
  }, [canContinueToGeneral, nameLengthError, name]);

  const canAction = useMemo(() => {
    return isUpdate
      ? permission.nameservers.update
      : permission.nameservers.create;
  }, [isUpdate, permission]);

  return (
    <ModalContent maxWidthClass={"max-w-xl"}>
      <ModalHeader
        icon={<DNSIcon className={"fill-netbird"} />}
        title={isUpdate ? preset?.name : "Add Nameserver"}
        description={"Use a nameserver to resolve domains in your network"}
        color={"netbird"}
      />

      <Tabs defaultValue={tab} onValueChange={(v) => setTab(v)} value={tab}>
        <TabsList justify={"start"} className={"px-8"}>
          <TabsTrigger value={"nameserver"}>
            <ServerIcon
              size={16}
              className={
                "text-nb-gray-500 group-data-[state=active]/trigger:text-netbird transition-all"
              }
            />
            Nameserver
          </TabsTrigger>
          <TabsTrigger value={"domains"} disabled={!canContinueToDomains}>
            <GlobeIcon
              size={16}
              className={
                "text-nb-gray-500 group-data-[state=active]/trigger:text-netbird transition-all"
              }
            />
            Domains
          </TabsTrigger>
          <TabsTrigger value={"general"} disabled={!canContinueToGeneral}>
            <Text
              size={16}
              className={
                "text-nb-gray-500 group-data-[state=active]/trigger:text-netbird transition-all"
              }
            />
            Name & Description
          </TabsTrigger>
        </TabsList>

        <TabsContent value={"nameserver"} className={"pb-8"}>
          <div className={"px-8 flex-col flex gap-6"}>
            <div>
              {nameservers.length > 0 && (
                <div className={"flex gap-3 w-full mb-3"}>
                  <div className={"flex flex-col gap-2 w-full"}>
                    {nameservers.map((ns, i) => {
                      return (
                        <NameserverInput
                          key={ns.id}
                          value={ns}
                          disabled={!canAction}
                          onChange={(ns) =>
                            setNameservers({ type: "UPDATE", index: i, ns })
                          }
                          onRemove={() =>
                            setNameservers({ type: "REMOVE", index: i })
                          }
                          onError={(error) => {
                            setNsError(error);
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              <Button
                disabled={nameservers.length >= 3 || !canAction}
                variant={"dotted"}
                className={"w-full"}
                size={"sm"}
                onClick={() => setNameservers({ type: "ADD" })}
              >
                <PlusIcon size={14} />
                Add Nameserver
              </Button>
            </div>

            <div>
              <Label>Distribution Groups</Label>
              <HelpText>
                Advertise this nameserver to peers that belong to the following
                groups
              </HelpText>
              <PeerGroupSelector
                onChange={setGroups}
                values={groups}
                disabled={!canAction}
              />
            </div>

            <FancyToggleSwitch
              value={enabled}
              onChange={setEnabled}
              label={
                <>
                  <Power size={15} />
                  Enable Nameserver
                </>
              }
              helpText={"Use this switch to enable or disable the nameserver."}
              disabled={!canAction}
            />
          </div>
        </TabsContent>
        <TabsContent value={"domains"} className={"pb-8"}>
          <div className={"px-8 flex flex-col gap-6"}>
            <div>
              <Label>Match Domains</Label>
              <HelpText>
                Add domain if you want to have a specific one resolved by this
                nameserver.
              </HelpText>
              <div>
                {domains.length > 0 && (
                  <div className={"flex gap-3 w-full mb-3"}>
                    <div className={"flex flex-col gap-2 w-full"}>
                      {domains.map((domain, i) => {
                        return (
                          <InputDomain
                            preventLeadingAndTrailingDots={true}
                            allowWildcard={false}
                            key={domain.id}
                            value={domain}
                            onChange={(d) =>
                              setDomains({ type: "UPDATE", index: i, d })
                            }
                            onError={(err) => {
                              setDomainError(err);
                            }}
                            onRemove={() =>
                              setDomains({ type: "REMOVE", index: i })
                            }
                            disabled={!canAction}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                <Button
                  variant={"dotted"}
                  className={"w-full"}
                  size={"sm"}
                  onClick={() => setDomains({ type: "ADD" })}
                  disabled={!canAction}
                >
                  <PlusIcon size={14} />
                  Add Domain
                </Button>
              </div>
            </div>
            <div
              className={cn(
                domains.length === 0 && "opacity-40 pointer-events-none",
              )}
            >
              <FancyToggleSwitch
                value={matchDomains}
                onChange={setMatchDomains}
                label={
                  <>
                    <Scan size={15} />
                    Mark match domains as search domains
                  </>
                }
                helpText={
                  "E.g., 'peer.example.com' will be accessible with 'peer'"
                }
                disabled={!canAction}
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent value={"general"} className={"px-8 pb-6"}>
          <div className={"flex flex-col gap-6"}>
            <div>
              <Label>DNS Name</Label>
              <HelpText>Enter a name for this nameserver.</HelpText>
              <Input
                autoFocus={true}
                tabIndex={0}
                error={nameLengthError}
                placeholder={"e.g., Public DNS"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canAction}
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <HelpText>
                Write a short description to add more context to this
                nameserver.
              </HelpText>
              <Textarea
                placeholder={
                  "e.g., Berlin office resolver for remote developers"
                }
                value={description}
                rows={3}
                disabled={!canAction}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <ModalFooter className={"items-center"}>
        <div className={"w-full"}>
          <Paragraph className={"text-sm mt-auto"}>
            Learn more about
            <InlineLink
              href={"https://docs.netbird.io/how-to/manage-dns-in-your-network"}
              target={"_blank"}
            >
              DNS
              <ExternalLinkIcon size={12} />
            </InlineLink>
          </Paragraph>
        </div>
        <div className={"flex gap-3 w-full justify-end"}>
          {!isUpdate ? (
            <>
              {tab == "nameserver" && (
                <ModalClose asChild={true}>
                  <Button variant={"secondary"}>Cancel</Button>
                </ModalClose>
              )}

              {tab == "domains" && (
                <Button
                  variant={"secondary"}
                  onClick={() => setTab("nameserver")}
                >
                  Back
                </Button>
              )}

              {tab == "nameserver" && (
                <Button
                  variant={"primary"}
                  onClick={() => setTab("domains")}
                  disabled={!canContinueToDomains}
                >
                  Continue
                </Button>
              )}

              {tab == "domains" && (
                <Button
                  variant={"primary"}
                  onClick={() => setTab("general")}
                  disabled={!canContinueToGeneral}
                >
                  Continue
                </Button>
              )}

              {tab == "general" && (
                <>
                  <Button
                    variant={"secondary"}
                    onClick={() => setTab("domains")}
                  >
                    Back
                  </Button>

                  <Button
                    variant={"primary"}
                    disabled={!canSubmit || !canAction}
                    onClick={submit}
                  >
                    <PlusCircle size={16} />
                    Add Nameserver
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              <ModalClose asChild={true}>
                <Button variant={"secondary"}>Cancel</Button>
              </ModalClose>
              <Button
                variant={"primary"}
                disabled={!canSubmit || !canAction}
                onClick={submit}
              >
                Save Changes
              </Button>
            </>
          )}
        </div>
      </ModalFooter>
    </ModalContent>
  );
}

function NameserverInput({
  value,
  onChange,
  onRemove,
  onError,
  disabled,
}: Readonly<{
  value: Nameserver;
  onChange: (ns: Nameserver) => void;
  onRemove: () => void;
  onError?: (error: boolean) => void;
  disabled?: boolean;
}>) {
  const [ip, setIP] = useState(value.ip);
  const [port, setPort] = useState<string>(value.port.toString());

  const handleIPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIP(e.target.value);
    onChange({ ...value, ip: e.target.value });
  };

  const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPort(e.target.value);
    onChange({ ...value, port: Number(e.target.value) });
  };

  const cidrError = useMemo(() => {
    if (ip == "") {
      return "";
    }
    const validCIDR = cidr.isValidAddress(ip);
    if (!validCIDR) {
      onError && onError(true);
      return "Please enter a valid IP, e.g., 192.168.1.0";
    }
    onError && onError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ip]);

  useEffect(() => {
    return () => onError && onError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={"flex gap-2 w-full"}>
      <div className={"w-full"}>
        <Input
          customPrefix={"IP"}
          placeholder={"e.g., 172.16.0.0"}
          maxWidthClass={"w-full"}
          value={ip}
          className={"font-mono !text-[13px]"}
          error={cidrError}
          onChange={handleIPChange}
          disabled={disabled}
        />
      </div>

      <Input
        maxWidthClass={"min-w-[150px] max-w-[150px]"}
        customPrefix={"Port"}
        placeholder={"53"}
        value={port}
        type={"number"}
        onChange={handlePortChange}
        disabled={disabled}
      />
      <Button
        className={"h-[42px]"}
        variant={"default-outline"}
        onClick={onRemove}
        disabled={disabled}
      >
        <MinusCircleIcon size={15} />
      </Button>
    </div>
  );
}

"use client";

import Breadcrumbs from "@components/Breadcrumbs";
import Button from "@components/Button";
import Card from "@components/Card";
import FancyToggleSwitch from "@components/FancyToggleSwitch";
import FullTooltip from "@components/FullTooltip";
import HelpText from "@components/HelpText";
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
import FullScreenLoading from "@components/ui/FullScreenLoading";
import LoginExpiredBadge from "@components/ui/LoginExpiredBadge";
import { PageNotFound } from "@components/ui/PageNotFound";
import { RestrictedAccess } from "@components/ui/RestrictedAccess";
import TextWithTooltip from "@components/ui/TextWithTooltip";
import useRedirect from "@hooks/useRedirect";
import useFetchApi from "@utils/api";
import { cn } from "@utils/helpers";
import dayjs from "dayjs";
import { isEmpty, trim } from "lodash";
import {
  Barcode,
  Cpu,
  FlagIcon,
  Globe,
  History,
  LockIcon,
  MapPin,
  MonitorSmartphoneIcon,
  NetworkIcon,
  PencilIcon,
  TerminalSquare,
  TimerResetIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toASCII } from "punycode";
import React, { useMemo, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { useSWRConfig } from "swr";
import RoundedFlag from "@/assets/countries/RoundedFlag";
import CircleIcon from "@/assets/icons/CircleIcon";
import NetBirdIcon from "@/assets/icons/NetBirdIcon";
import PeerIcon from "@/assets/icons/PeerIcon";
import { useCountries } from "@/contexts/CountryProvider";
import PeerProvider, { usePeer } from "@/contexts/PeerProvider";
import { usePermissions } from "@/contexts/PermissionsProvider";
import RoutesProvider from "@/contexts/RoutesProvider";
import { useHasChanges } from "@/hooks/useHasChanges";
import type { Peer } from "@/interfaces/Peer";
import PageContainer from "@/layouts/PageContainer";
import useGroupHelper from "@/modules/groups/useGroupHelper";
import { AccessiblePeersSection } from "@/modules/peer/AccessiblePeersSection";
import { PeerExpirationToggle } from "@/modules/peer/PeerExpirationToggle";
import { PeerNetworkRoutesSection } from "@/modules/peer/PeerNetworkRoutesSection";

export default function PeerPage() {
  const queryParameter = useSearchParams();
  const { isRestricted } = usePermissions();
  const peerId = queryParameter.get("id");
  const {
    data: peer,
    isLoading,
    error,
  } = useFetchApi<Peer>("/peers/" + peerId, true);

  useRedirect("/peers", false, !peerId || isRestricted);

  const peerKey = useMemo(() => {
    let id = peer?.id ?? "";
    let ssh = peer?.ssh_enabled ? "1" : "0";
    let expiration = peer?.login_expiration_enabled ? "1" : "0";
    return `${id}-${ssh}-${expiration}`;
  }, [peer]);

  if (isRestricted) {
    return (
      <PageContainer>
        <RestrictedAccess page={"Peer Information"} />
      </PageContainer>
    );
  }

  if (error)
    return (
      <PageNotFound
        title={error?.message}
        description={
          "The peer you are attempting to access cannot be found. It may have been deleted, or you may not have permission to view it. Please verify the URL or return to the dashboard."
        }
      />
    );

  return peer && !isLoading ? (
    <PeerProvider peer={peer} key={peerId}>
      <PeerOverview key={peerKey} />
    </PeerProvider>
  ) : (
    <FullScreenLoading />
  );
}

function PeerOverview() {
  const { peer } = usePeer();

  return (
    <PageContainer>
      <RoutesProvider>
        <div className={"p-default py-6 pb-0"}>
          <Breadcrumbs>
            <Breadcrumbs.Item
              href={"/peers"}
              label={"Peers"}
              icon={<PeerIcon size={13} />}
            />
            <Breadcrumbs.Item label={peer.ip} active />
          </Breadcrumbs>
          <PeerGeneralInformation />
        </div>
        <PeerOverviewTabs />
      </RoutesProvider>
    </PageContainer>
  );
}

const PeerGeneralInformation = () => {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { peer, user, peerGroups, openSSHDialog, update } = usePeer();
  const [ssh, setSsh] = useState(peer.ssh_enabled);
  const [name, setName] = useState(peer.name);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [loginExpiration, setLoginExpiration] = useState(
    peer.login_expiration_enabled,
  );
  const [inactivityExpiration, setInactivityExpiration] = useState(
    peer.inactivity_expiration_enabled,
  );
  const [selectedGroups, setSelectedGroups, { getAllGroupCalls }] =
    useGroupHelper({
      initial: peerGroups,
      peer,
    });

  /**
   * Detect if there are changes in the peer information, if there are changes, then enable the save button.
   */
  const { hasChanges, updateRef: updateHasChangedRef } = useHasChanges([
    ssh,
    selectedGroups,
    loginExpiration,
    inactivityExpiration,
  ]);

  const updatePeer = async (newName?: string) => {
    let batchCall: Promise<any>[] = [];
    const groupCalls = getAllGroupCalls();

    if (permission.peers.update) {
      const updateRequest = update({
        name: newName ?? name,
        ssh,
        loginExpiration,
        inactivityExpiration,
      });
      batchCall = groupCalls ? [...groupCalls, updateRequest] : [updateRequest];
    } else {
      batchCall = [...groupCalls];
    }

    notify({
      title: name,
      description: "Peer was successfully saved",
      promise: Promise.all(batchCall).then(() => {
        mutate("/peers/" + peer.id);
        mutate("/groups");
        updateHasChangedRef([
          ssh,
          selectedGroups,
          loginExpiration,
          inactivityExpiration,
        ]);
      }),
      loadingMessage: "Saving the peer...",
    });
  };

  const { permission } = usePermissions();

  return (
    <>
      <div className={"flex justify-between max-w-6xl items-start"}>
        <div>
          <div className={"flex items-center gap-3"}>
            <h1 className={"flex items-center gap-3"}>
              <CircleIcon
                active={peer.connected}
                size={12}
                className={"mb-[3px] shrink-0"}
              />
              <TextWithTooltip text={name} maxChars={30} />

              {permission.peers.update && (
                <Modal
                  open={showEditNameModal}
                  onOpenChange={setShowEditNameModal}
                >
                  <ModalTrigger>
                    <div
                      className={
                        "flex items-center gap-2 dark:text-neutral-300 text-neutral-500 hover:text-neutral-100 transition-all hover:bg-nb-gray-800/60 py-2 px-3 rounded-md cursor-pointer"
                      }
                    >
                      <PencilIcon size={16} />
                    </div>
                  </ModalTrigger>
                  <EditNameModal
                    onSuccess={(newName) => {
                      updatePeer(newName).then(() => {
                        setName(newName);
                        setShowEditNameModal(false);
                      });
                    }}
                    peer={peer}
                    initialName={name}
                    key={showEditNameModal ? 1 : 0}
                  />
                </Modal>
              )}
            </h1>
            <LoginExpiredBadge loginExpired={peer.login_expired} />
          </div>
          <div className={"flex items-center gap-8"}>
            <Paragraph className={"flex items-center"}>{user?.email}</Paragraph>
          </div>
        </div>
        <div className={"flex gap-4"}>
          <Button
            variant={"default"}
            className={"w-full"}
            onClick={() => router.push("/peers")}
          >
            Cancel
          </Button>
          <Button
            variant={"primary"}
            className={"w-full"}
            onClick={() => updatePeer()}
            disabled={
              !hasChanges || !permission.peers.read || !permission.groups.update
            }
          >
            Save Changes
          </Button>
        </div>
      </div>

      <div
        className={
          "flex-wrap xl:flex-nowrap flex gap-10 w-full mt-5 max-w-6xl items-start"
        }
      >
        <PeerInformationCard peer={peer} />

        <div className={"flex flex-col gap-6 lg:w-1/2 transition-all"}>
          <div>
            <PeerExpirationToggle
              peer={peer}
              value={loginExpiration}
              icon={<TimerResetIcon size={16} />}
              onChange={(state) => {
                setLoginExpiration(state);
                !state && setInactivityExpiration(false);
              }}
            />
            {permission.peers.update && !!peer?.user_id && (
              <div
                className={cn(
                  "border border-nb-gray-900 border-t-0 rounded-b-md bg-nb-gray-940 px-[1.28rem] pt-3 pb-5 flex flex-col gap-4 mx-[0.25rem]",
                  !loginExpiration
                    ? "opacity-50 pointer-events-none"
                    : "bg-nb-gray-930/80",
                )}
              >
                <PeerExpirationToggle
                  peer={peer}
                  variant={"blank"}
                  value={inactivityExpiration}
                  onChange={setInactivityExpiration}
                  title={"Require login after disconnect"}
                  description={
                    "Enable to require authentication after users disconnect from management for 10 minutes."
                  }
                  className={
                    !loginExpiration ? "opacity-40 pointer-events-none" : ""
                  }
                />
              </div>
            )}
          </div>

          <FullTooltip
            content={
              <div
                className={"flex gap-2 items-center !text-nb-gray-300 text-xs"}
              >
                <LockIcon size={14} />
                <span>
                  {`You don't have the required permissions to update this
                          setting.`}
                </span>
              </div>
            }
            interactive={false}
            className={"w-full block"}
            disabled={!permission.peers.update}
          >
            <FancyToggleSwitch
              value={ssh}
              disabled={!permission.peers.update}
              onChange={(set) =>
                !set
                  ? setSsh(false)
                  : openSSHDialog().then((confirm) => setSsh(confirm))
              }
              label={
                <>
                  <TerminalSquare size={16} />
                  SSH Access
                </>
              }
              helpText={
                "Enable the SSH server on this peer to access the machine via an secure shell."
              }
            />
          </FullTooltip>

          {permission.groups.read && (
            <div>
              <Label>Assigned Groups</Label>
              <HelpText>
                Use groups to control what this peer can access.
              </HelpText>
              <PeerGroupSelector
                disabled={!permission.groups.update}
                onChange={setSelectedGroups}
                values={selectedGroups}
                hideAllGroup={true}
                peer={peer}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const PeerOverviewTabs = () => {
  const { peer } = usePeer();
  const { permission } = usePermissions();

  const [tab, setTab] = useState(
    permission.routes.read ? "network-routes" : "accessible-peers",
  );

  return (
    <Tabs
      defaultValue={tab}
      onValueChange={(v) => setTab(v)}
      value={tab}
      className={"pt-10 pb-0 mb-0"}
    >
      <TabsList justify={"start"} className={"px-8"}>
        {permission.routes.read && (
          <TabsTrigger value={"network-routes"}>
            <NetworkIcon size={16} />
            Network Routes
          </TabsTrigger>
        )}

        {peer?.id && permission.peers.read && (
          <TabsTrigger value={"accessible-peers"}>
            <MonitorSmartphoneIcon size={16} />
            Accessible Peers
          </TabsTrigger>
        )}
      </TabsList>

      {permission.routes.read && (
        <TabsContent value={"network-routes"} className={"pb-8"}>
          <PeerNetworkRoutesSection peer={peer} />
        </TabsContent>
      )}

      {peer?.id && permission.peers.read && (
        <TabsContent value={"accessible-peers"} className={"pb-8"}>
          <AccessiblePeersSection peerID={peer.id} />
        </TabsContent>
      )}
    </Tabs>
  );
};

function PeerInformationCard({ peer }: Readonly<{ peer: Peer }>) {
  const { isLoading, getRegionByPeer } = useCountries();

  const countryText = useMemo(() => {
    return getRegionByPeer(peer);
  }, [getRegionByPeer, peer]);

  return (
    <Card className={"w-full xl:w-1/2"}>
      <Card.List>
        <Card.ListItem
          copy
          copyText={"NetBird IP-Address"}
          label={
            <>
              <MapPin size={16} />
              NetBird IP-Address
            </>
          }
          value={peer.ip}
        />

        <Card.ListItem
          copy
          copyText={"Public IP-Address"}
          label={
            <>
              <NetworkIcon size={16} />
              Public IP-Address
            </>
          }
          value={peer.connection_ip}
        />

        <Card.ListItem
          copy
          copyText={"DNS label"}
          label={
            <>
              <Globe size={16} />
              Domain Name
            </>
          }
          className={
            peer?.extra_dns_labels && peer.extra_dns_labels.length > 0
              ? "items-start"
              : ""
          }
          value={peer.dns_label}
          extraText={peer?.extra_dns_labels}
        />

        <Card.ListItem
          copy
          copyText={"Hostname"}
          label={
            <>
              <MonitorSmartphoneIcon size={16} />
              Hostname
            </>
          }
          value={peer.hostname}
        />

        <Card.ListItem
          label={
            <>
              <FlagIcon size={16} />
              Region
            </>
          }
          tooltip={false}
          value={
            isEmpty(peer.country_code) ? (
              "Unknown"
            ) : (
              <>
                {isLoading ? (
                  <Skeleton width={140} />
                ) : (
                  <div className={"flex gap-2 items-center"}>
                    <div className={"border-0 border-nb-gray-800 rounded-full"}>
                      <RoundedFlag country={peer.country_code} size={12} />
                    </div>
                    {countryText}
                  </div>
                )}
              </>
            )
          }
        />

        <Card.ListItem
          label={
            <>
              <Cpu size={16} />
              Operating System
            </>
          }
          value={peer.os}
        />

        {peer.serial_number && peer.serial_number !== "" && (
          <Card.ListItem
            label={
              <>
                <Barcode size={16} />
                Serial Number
              </>
            }
            value={peer.serial_number}
          />
        )}

        <Card.ListItem
          label={
            <>
              <History size={16} />
              Last seen
            </>
          }
          value={
            peer.connected
              ? "just now"
              : dayjs(peer.last_seen).format("D MMMM, YYYY [at] h:mm A") +
                " (" +
                dayjs().to(peer.last_seen) +
                ")"
          }
        />

        <Card.ListItem
          label={
            <>
              <NetBirdIcon size={16} />
              Agent Version
            </>
          }
          value={peer.version}
        />

        {peer.ui_version && (
          <Card.ListItem
            label={
              <>
                <NetBirdIcon size={16} />
                UI Version
              </>
            }
            value={peer.ui_version?.replace("netbird-desktop-ui/", "")}
          />
        )}
      </Card.List>
    </Card>
  );
}

interface ModalProps {
  onSuccess: (name: string) => void;
  peer: Peer;
  initialName: string;
}

function EditNameModal({ onSuccess, peer, initialName }: Readonly<ModalProps>) {
  const [name, setName] = useState(initialName);

  const isDisabled = useMemo(() => {
    if (name === peer.name) return true;
    const trimmedName = trim(name);
    return trimmedName.length === 0;
  }, [name, peer]);

  const domainNamePreview = useMemo(() => {
    let punyName = toASCII(name.toLowerCase());
    punyName = punyName.replace(/[^a-z0-9]/g, "-");
    let domain = "";
    if (peer.dns_label) {
      const labelList = peer.dns_label.split(".");
      if (labelList.length > 1) {
        labelList.splice(0, 1);
        domain = "." + labelList.join(".");
      }
    }
    return punyName + domain;
  }, [name, peer]);

  return (
    <ModalContent maxWidthClass={"max-w-md"}>
      <form>
        <ModalHeader
          title={"Edit Peer Name"}
          description={"Set an easily identifiable name for your peer."}
          color={"blue"}
        />

        <div className={"p-default flex flex-col gap-4"}>
          <div>
            <Input
              placeholder={"e.g., AWS Servers"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Card className={"w-full px-6 pt-5 pb-4"}>
            <Label>
              <Globe size={15} />
              Domain Name Preview
            </Label>
            <HelpText className={"mt-2"}>
              If the domain name already exists, we add an increment number
              suffix to it.
            </HelpText>
            <div className={"text-netbird text-sm break-all whitespace-normal"}>
              {domainNamePreview}
            </div>
          </Card>
        </div>

        <ModalFooter className={"items-center"} separator={false}>
          <div className={"flex gap-3 w-full justify-end"}>
            <ModalClose asChild={true}>
              <Button variant={"secondary"} className={"w-full"}>
                Cancel
              </Button>
            </ModalClose>

            <Button
              variant={"primary"}
              className={"w-full"}
              onClick={() => onSuccess(name)}
              disabled={isDisabled}
              type={"submit"}
            >
              Save
            </Button>
          </div>
        </ModalFooter>
      </form>
    </ModalContent>
  );
}

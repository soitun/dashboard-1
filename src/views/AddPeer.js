import React, {useEffect, useState} from "react";
import {useAuth0, withAuthenticationRequired} from "@auth0/auth0-react";
import Loading from "../components/Loading";
import {getSetupKeys} from "../api/ManagementAPI";
import AddPeerTabSelector from "../components/addpeer/AddPeerTabSelector";
import SetupKeySelect from "../components/addpeer/SetupKeySelect";

export const AddPeerComponent = () => {

        const [setupKeys, setSetupKeys] = useState([])
        const [loading, setLoading] = useState(true)
        const [error, setError] = useState(null)
        const [selectedKey, setSelectedKey] = useState(null)

        const {
            getAccessTokenSilently,
        } = useAuth0();

        const handleError = error => {
            console.error('Error to fetch data:', error);
            setLoading(false)
            setError(error);
        };

        useEffect(() => {
            getSetupKeys(getAccessTokenSilently)
                .then(responseData => setSetupKeys(responseData))
                .then(() => setLoading(false))
                .catch(error => handleError(error))
        }, [getAccessTokenSilently])

        return (

            <>
                <div className="py-10 bg-gray-50 overflow-hidden rounded max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <header className="sm:flex sm:items-center">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 sm:flex-auto">
                            <h1 className="text-xl font-semibold text-gray-900">Add Peer</h1>
                            <p className="mt-2 text-sm text-gray-700">
                                To get started with Netbird just install the app and log in.
                            </p>
                        </div>
                    </header>

                    <main>
                        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                            <div className="px-4 py-4 sm:px-0">
                                {loading && (<Loading/>)}
                                {error != null && (
                                    <span>{error.toString()}</span>
                                )}
                                {setupKeys && (<nav aria-label="Progress">
                                    <AddPeerTabSelector setupKey={selectedKey}/>
                                </nav>)}

                            </div>
                        </div>
                    </main>
                </div>
            </>
        );
    }
;

export default withAuthenticationRequired(AddPeerComponent,
    {
        onRedirecting: () => <Loading/>,
    }
);
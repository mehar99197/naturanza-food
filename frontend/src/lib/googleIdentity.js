// Singleton coordinator for Google Identity Services (GSI).
//
// Google's client library logs "[GSI_LOGGER]: google.accounts.id.initialize() is
// called multiple times" whenever initialize() runs more than once in the same
// document lifecycle — which @react-oauth/google's <GoogleLogin> triggers on
// every width change (e.g., mobile layout measurement) and every /login <->
// /register SPA navigation.
//
// Keeping initialize() strictly once per clientId while dynamically dispatching
// to the active screen's callbacks lets renderButton() run cleanly as needed
// without ever re-initializing GSI.

let initializedClientId = null;
let initializedGsiApi = null;
let registeredHandlers = [];

const extractClientId = (credentialResponse) =>
  credentialResponse?.clientId ?? credentialResponse?.client_id;

const getActiveHandlers = () =>
  registeredHandlers.length > 0
    ? registeredHandlers[registeredHandlers.length - 1]
    : null;

export const registerGoogleIdentityHandlers = (handlers) => {
  if (!handlers) return;
  registeredHandlers = registeredHandlers.filter((entry) => entry !== handlers);
  registeredHandlers.push(handlers);
};

export const unregisterGoogleIdentityHandlers = (handlers) => {
  registeredHandlers = registeredHandlers.filter((entry) => entry !== handlers);
};

export const ensureGoogleIdentityInitialized = (gsiIdApi, clientId) => {
  if (!gsiIdApi || typeof gsiIdApi.initialize !== "function" || !clientId) {
    return false;
  }

  if (initializedGsiApi === gsiIdApi && initializedClientId === clientId) {
    return false;
  }

  gsiIdApi.initialize({
    client_id: clientId,
    callback: (credentialResponse) => {
      const activeHandlers = getActiveHandlers();
      if (!credentialResponse?.credential) {
        activeHandlers?.onError?.();
        return;
      }

      activeHandlers?.onSuccess?.({
        credential: credentialResponse.credential,
        clientId: extractClientId(credentialResponse),
        select_by: credentialResponse.select_by,
      });
    },
  });

  initializedGsiApi = gsiIdApi;
  initializedClientId = clientId;
  return true;
};

export const resetGoogleIdentityState = () => {
  initializedClientId = null;
  initializedGsiApi = null;
  registeredHandlers = [];
};

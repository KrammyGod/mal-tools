import fs from 'fs/promises';
import authenticate from './bin/auth.js';
import GetMALException from './exceptions.js';
import 'dotenv/config';
/**
 * @type {import('./auth.json')}
 */
let authData;
/**
 * Loads the auth data from auth.json into the global variable
 * @returns {Promise<void>}
 */
async function loadAuthData() {
    return fs.readFile('auth.json', 'utf-8').then(data => { authData = JSON.parse(data); }).catch(() => reauthenticate());
}
/**
 * Creates the authentication dialog and loads the auth data again after it's done
 * @returns {Promise<void>}
 */
function reauthenticate() {
    console.log('access token was missing or invalid, re-authenticating...');
    return authenticate().then(() => loadAuthData());
}

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

/**
 * Just a simple wrapper to log the fetch request before fetching.
 * @param {string} url The url to pass to fetch
 * @param {Parameters<fetch>[1]} options The options to pass to fetch
 * @returns {ReturnType<fetch>}
 */
function loggedFetch(url, options) {
    console.log(`${options?.method || 'GET'} ${url}`);
    return fetch(url, options);
}

/**
 * Refreshes the access token using the global auth data
 * Returns a boolean indicating success.
 * If unsuccessful, reauthentication is required.
 * @returns {Promise<boolean>}
 */
async function refreshToken() {
    const bodyParams = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        refresh_token: authData.refresh_token,
    });
    // Only add client secret if it exists
    if (CLIENT_SECRET) {
        bodyParams.append('client_secret', CLIENT_SECRET);
    }
    // POST the endpoint to get the access token
    const fetchedResponse = await loggedFetch('https://myanimelist.net/v1/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        },
        body: bodyParams,
    }).then(res => res.json()).catch(console.error);
    if (!fetchedResponse) {
        console.log('failed to refresh access token.');
        return false;
    }
    if (fetchedResponse.error) {
        console.log('error from refreshing access token:');
        console.dir(fetchedResponse, { depth: null });
        return false;
    }
    // Write to auth.json and exit
    return fs.writeFile('auth.json', JSON.stringify(fetchedResponse), 'utf-8').then(() => {
        console.log('successfully refreshed access token.');
        authData = fetchedResponse;
        return true;
    }, () => {
        console.log('failed to write new access token.');
        return false;
    });
}

/**
 * Makes a request to the MAL API with the global auth data
 * @param {string} endpoint The MAL endpoint with the path parameters
 * @param {{
 *     params?: URLSearchParams
 *     method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
 * } | undefined} options The parameters for the MAL request
 * @param {boolean} fourZeroOne Whether or not we have already gotten a 401, used only internally for automatically refreshing tokens
 * @returns {Promise<any>}
 */
function makeMALRequest(endpoint, options, fourZeroOne = false) {
    const method = options?.method || 'GET';
    const params = options?.params || new URLSearchParams();
    return loggedFetch(`https://api.myanimelist.net/v2/${endpoint}?${params}`, {
        method: method,
        headers: {
            'Authorization': `Bearer ${authData.access_token}`,
            'Accept': 'application/json',
        },
    }).then(res => {
        if (!res.ok) {
            if (res.status === 401) {
                // First time hitting 401, we can retry
                if (!fourZeroOne) {
                    // First try to refresh the token
                    // Upon failure, reauthenticate
                    return refreshToken().then(success => {
                        if (success) {
                            return makeMALRequest(endpoint, options, true);
                        }
                        return reauthenticate().then(() => makeMALRequest(endpoint, options, true));
                    });
                }
                // We've re-authenticated and it still doesn't work, throw the error for more details.
            }
            return res.json().then(json => {
                throw GetMALException(res.status, json);
            });
        }
        return res.json();
    });
}

// Example usage, can be tested via `npm start`
// For full API details, see https://myanimelist.net/apiconfig/references/api/v2
loadAuthData().then(() => makeMALRequest(
    'users/@me/animelist',
    {
        params: new URLSearchParams({
            status: 'completed',
            limit: 10,
            sort: 'list_updated_at',
        })
    }
)).then(ret => console.dir(ret.data, { depth: null })).catch(console.error);

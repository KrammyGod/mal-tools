#!/usr/bin/env node
import fs from 'fs';
import http from 'http';
import open from 'open';
import path from 'path';
import pkceChallenge from 'pkce-challenge';
import 'dotenv/config';

// Global state to be used for the authentication process
const state = crypto.getRandomValues(new Uint8Array(16)).join('');
const code_challenge = await pkceChallenge().then(ret => ret.code_challenge);
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

/**
 * Opens the MAL OAuth2 authentication page in the default browser
 * @returns {Promise<import('child_process').ChildProcess>}
 */
async function openAuthDialog() {
    const url = new URL('https://myanimelist.net/v1/oauth2/authorize');
    url.searchParams.append('state', state);
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('client_id', CLIENT_ID);
    url.searchParams.append('code_challenge', code_challenge);
    url.searchParams.append('code_challenge_method', 'plain');
    return open(url.href);
}

// Other modules can use this one to wait for authentication to complete.
export default function authenticate() {
    return new Promise(resolve => {
        // Start a webserver to listen for the redirect and start the process when ready.
        const server = http.createServer(async (req, res) => {
            const url = new URL(req.url, 'http://localhost:5000/');
            if (url.searchParams.get('state') !== state) {
                return res.end('Invalid state parameter');
            }
            const code = url.searchParams.get('code');
            if (code === null) {
                // Omit the state parameter from the response
                const paramsAsObject = Object.fromEntries(url.searchParams.entries());
                delete paramsAsObject.state;
                res.end(JSON.stringify(paramsAsObject));
                console.log('authentication failed:');
                console.dir(paramsAsObject, { depth: null });
                server.closeAllConnections();
                return server.close();
            }
            res.end('OK, you can close this tab and return to the command line.');
            console.log('authentication successful, getting access token...');

            // Now we make the request to get the access token
            const bodyParams = new URLSearchParams({
                response_type: 'code',
                client_id: CLIENT_ID,
                code: code,
                code_verifier: code_challenge, // plain PKCE, code_verifier = code_challenge
                grant_type: 'authorization_code',
            });
            // Only add client secret if it exists
            if (CLIENT_SECRET) {
                bodyParams.append('client_secret', CLIENT_SECRET);
            }
            // POST the endpoint to get the access token
            const fetchedResponse = await fetch('https://myanimelist.net/v1/oauth2/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                },
                body: bodyParams,
            }).then(res => res.json()).catch(console.error);
            if (!fetchedResponse) {
                console.log('failed to fetch access token.');
                server.closeAllConnections();
                return server.close();
            } else if (fetchedResponse.error) {
                console.log('error from fetching access token:');
                console.dir(fetchedResponse, { depth: null });
                server.closeAllConnections();
                return server.close();
            }
            // Write to auth.json and exit
            fs.writeFile('auth.json', JSON.stringify(fetchedResponse), 'utf-8', () => {
                console.log('access token granted. completed.');
                server.closeAllConnections();
                server.close();
            });
        });
        server.on('close', resolve);
        server.listen(5000, () => {
            // Server is ready, start authentication
            return openAuthDialog();
        });
    });
};

if (path.basename(process.argv?.[1]) === path.basename(import.meta.url)) {
    // This script was run directly, start the authentication process
    authenticate();
}

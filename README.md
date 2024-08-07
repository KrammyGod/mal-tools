# MAL Tools
A collection of helpers used to access the MyAnimeList(MAL) API. The API reference can be found [here](https://myanimelist.net/apiconfig/references/api/v2), and the API client configuration can be found [here](https://myanimelist.net/apiconfig).

## Usage
1. Make a copy of `.env.example`, and name it `.env`. Fill in the `CLIENT_ID` and `CLIENT_SECRET` (if required) fields. If you don't have a `CLIENT_ID`, visit [here](https://myanimelist.net/apiconfig) to create one.
2. Run `npm i` to install the required dependencies.
3. Run `npm start` to make a sample request to the MAL API. Upon first use, it should prompt you to authorize your application. Follow the instructions to authorize your application. If all is done correctly, you should see an `auth.json` file in the root of the project.
4. Finally, you can modify [index.js](./index.js#L130) to make any request by calling `makeMALRequest`. Documentation link is also available in the comments. Ensure that `loadAuthData` is called before making any requests, it only needs to be called once per run.

## Helpful Commands
- `npm exec auth`/`npx .` - Both of these commands can be used to do a single authorization request, which will overwrite any existing `auth.json` file.

import { WillPowerUpAppKey } from "../constants.js";
import { sendRequest } from "./requests.js";
import { getToken } from "./auth.js";

const buildTrelloRequest = function(token, resource, params='') {
    return `https://api.trello.com/1${resource}?key=${WillPowerUpAppKey}&token=${token}${params}`;
};

export const getTokenInfo = function (token) {
    return sendRequest(buildTrelloRequest(token, `/tokens/${token}`));
}

export const getMember = function(t, id) {
    return new Promise(function(resolve, reject) {
        getToken(t)
            .then(function(token) {
                sendRequest(buildTrelloRequest(token, `/members/${id}`))
                    .then(function(member) {
                        resolve(member);
                    })
                    .catch(function(err) {
                        resolve(undefined);
                    })
            });
    });
}
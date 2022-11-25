import { WillPowerUpAppKey } from "../constants.js";
import { sendRequest } from "./requests.js";
import { getTrelloToken } from "./auth.js";

const buildTrelloRequest = function(token, resource, params={}) {
    return `https://api.trello.com/1${resource}?key=${WillPowerUpAppKey}&token=${token}${serialize(params)}`;
};

let serialize = function(obj) {
    let str = [];
    for (let p in obj) {
        if (obj.hasOwnProperty(p)) {
            str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
        }
    }
    return str.length > 0 ? '&' + str.join("&") : "";
}

export const getTrelloTokenInfo = function (token) {
    return sendRequest(buildTrelloRequest(token, `/tokens/${token}`));
}

export const getMember = function(t, id) {
    return new Promise(function(resolve, reject) {
        getTrelloToken(t)
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

export const putCard = function(t, id, name, description) {
    return new Promise(function(resolve, reject) {
        getTrelloToken(t)
            .then(function(token) {
                sendRequest(buildTrelloRequest(token, `/cards/${id}`, {
                    name: name,
                    desc: description,
                }), "PUT")
                    .then(function(member) {
                        resolve(member);
                    })
                    .catch(function(err) {
                        resolve(undefined);
                    })
            });
    });
}
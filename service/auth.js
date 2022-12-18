import { getTrelloTokenInfo } from "./api.js";

// getTrelloToken returns the token for the current user if it exists
export const getTrelloToken = function (t) {
    return new Promise(function(resolve, reject) {
        t.get('member', 'private', 'token')
            .then(function(token) {

                if (token === undefined || token === '') {
                    // check in local storage
                    token = localStorage.getItem('token');
                }

                if (token === undefined || token === '') {
                    resolve(undefined);
                }
                resolve(token);
            });
    });
};
import { getTrelloTokenInfo } from "../../service/api.js";

let params = new URLSearchParams(window.location.hash.substring(1));
console.log(window.location.hash);
let token = params.get('token');
if (token !== undefined && token.length > 0) {
    // check if the token is valid
    getTrelloTokenInfo(token)
        .then(function (tokenInfo) {
            // all good the token is valid
            if (window.opener) {
                window.opener.authorize(token);
            } else {
                localStorage.setItem('token', token);
            }
            window.close();
        });
} else {
    window.close();
}
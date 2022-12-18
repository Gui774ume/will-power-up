import { getTrelloTokenInfo } from "../../service/api.js";

let params = new URLSearchParams(window.location.hash.substring(1));
let token = params.get('token');
console.log(window.location.hash);
if (token !== undefined && token.length > 0) {
    // check if the token is valid
    getTrelloTokenInfo(token)
        .then(function (tokenInfo) {
            console.log(tokenInfo, window.location.hash);
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
import {CALENDAR_DOC, PEOPLE_DOC} from "../google-account-chooser/account-helper.js";
import { prepareSearchContacts } from "./contacts.js";

let t = TrelloPowerUp.iframe();
var Promise = TrelloPowerUp.Promise;
let trelloReady = false;
let addGoogleContact = document.getElementById('add_google_contact');

// Google API service
let googleAPIReady = false;
let googleAPIInitialized = false;
let googleAPIScript = document.createElement('script');
googleAPIScript.src = 'https://apis.google.com/js/api.js';
googleAPIScript.onload = function() {
    gapi.load('client', async function() {
        googleAPIReady = true;
        await maybeRenderPage();
    });
};
document.body.appendChild(googleAPIScript);

let maybeRenderPage = async function() {
    if (googleAPIReady && trelloReady) {
        if (!googleAPIInitialized) {
            await t.get('board', 'shared', 'google_api_key')
                .then(async function (key) {
                    await gapi.client.init({
                        apiKey: key,
                        discoveryDocs: [PEOPLE_DOC, CALENDAR_DOC],
                    });
                    googleAPIInitialized = true;
                });
        }
        renderPage();
    }
};

let renderPage = async function() {
    t.sizeTo("#account_chooser_wrapper")
        .catch(function(e) {});
};

t.render(function(){
    trelloReady = true;
    maybeRenderPage();
});

addGoogleContact.addEventListener('click', function() {
    // jump to the Google Account chooser page, configure callback
    return t.popup({
        title: 'Choose a Google Account',
        url: '../google-account-chooser/account-chooser.html',
        height: 120,
        args: {
            callback: "prepare_search_contacts",
        },
    });
});
import { getBoards, getLists } from "../../service/api.js";
import { WillPowerUpAppName } from "../../constants.js";
import { getTrelloToken } from "../../service/auth.js";

let t = TrelloPowerUp.iframe();
let inputGoogleAPIKey = document.getElementById('google_api_key');
let save = document.getElementById('save');
let googleMapsAutocomplete = document.getElementById('google_maps_autocomplete');
let googleCalendarsList = document.getElementById('google_calendars_list');
let googleAccountsList = document.getElementById('google_accounts_list');
let addGoogleAccountButton = document.getElementById('add_google_account');
let addStarredGoogleCalendarButton = document.getElementById('add_starred_google_account');
let cardArchiverDestinationBoardInput = document.getElementById('card_archiver_destination_board');
let cardArchiverDoneListInput = document.getElementById('card_archiver_done_list');
let authorizeButton = document.getElementById('authorize_button');
let googleCalendarSyncTimeLimit = document.getElementById('google_calendar_sync_time_limit');

t.render(async function(){
    let promiseList = [];

    promiseList.push(
        t.get('board', 'shared', 'google_api_key')
            .then(async function(google_api_key) {
                if (google_api_key !== undefined) {
                    inputGoogleAPIKey.value = google_api_key;
                }
                await t.get('board', 'shared', 'google_maps_autocomplete')
                    .then(function(autocompleteEnabled) {
                        if (autocompleteEnabled === undefined) {
                            autocompleteEnabled = true;
                        }
                        if (autocompleteEnabled) {
                            googleMapsAutocomplete.textContent = "Disable Google Maps autocomplete";
                            googleMapsAutocomplete.classList.remove("mod-primary");
                            googleMapsAutocomplete.classList.add("mod-danger");
                        } else {
                            googleMapsAutocomplete.textContent = "Enable Google Maps autocomplete";
                            googleMapsAutocomplete.classList.remove("mod-danger");
                            googleMapsAutocomplete.classList.add("mod-primary");
                        }
                    });
            })
    );

    promiseList.push(
        t.get('board', 'shared', 'google_calendar_sync_time_limit')
            .then(function(daysCount) {
                if (daysCount === undefined) {
                    // fall back to 1 week
                    daysCount = {
                        name: "1 week",
                        count: 7,
                    }
                }
                googleCalendarSyncTimeLimit.value = daysCount.name;
            })
    );

    promiseList.push(
        t.get('board', 'shared', 'archive_board')
            .then(async function(board) {
                if (board !== undefined) {
                    cardArchiverDestinationBoardInput.value = board.name;
                }

                await t.get('board', 'shared', 'archive_list')
                    .then(function(list) {
                        if (list !== undefined) {
                            cardArchiverDoneListInput.value = list.name;
                        }
                    });
            })
    );

    promiseList.push(
        t.get('board', 'private', 'google_accounts')
            .then(async function(accounts) {
                if (accounts === undefined) {
                    accounts = [];
                }

                googleAccountsList.innerHTML = '';
                for (const email of accounts) {
                    await t.get('board', 'private', email)
                        .then(function (account) {
                            if (account !== undefined) {
                                let node = generateGoogleAccountEntry(account);
                                googleAccountsList.appendChild(node);
                            }
                        });
                }

                await t.get('board', 'private', 'starred_calendars')
                    .then(async function (starredCalendars) {
                        if (starredCalendars === undefined) {
                            starredCalendars = [];
                        }

                        googleCalendarsList.innerHTML = '';
                        for (const starredCalendar of starredCalendars) {
                            await t.get('board', 'private', 'calendar_' + starredCalendar.id)
                                .then(function (calendar) {
                                    if (calendar !== undefined) {
                                        let node = generateGoogleCalendarEntry(calendar, starredCalendar.email);
                                        googleCalendarsList.appendChild(node);
                                    }
                                });
                        }
                    });
            })
    );

    await Promise.all(promiseList);
    t.sizeTo('#settings').catch(function() {});
});

let generateGoogleCalendarEntry = function(calendar, email) {
    // <div className="account-elem">
    //     <div className="trash-icon-wrapper">
    //         <span role="img" className="trash-icon input-icon"></span>
    //     </div>
    //     <div>
    //         <b>Tykrie et Willou</b>
    //         <br>
    //             <em>gui77aume.fournier@gmail.com</em>
    //     </div>
    // </div>
    let calendarElem = document.createElement('div');
    calendarElem.classList.add('account-elem');
    let iconWrapper = document.createElement('div');
    iconWrapper.classList.add("trash-icon-wrapper");
    let icon = document.createElement('span');
    icon.role = "img";
    icon.classList.add("trash-icon");
    icon.classList.add("input-icon");
    icon.addEventListener('click', function(evt) {
        t.get('board', 'private', 'starred_calendars')
            .then(function(starredCalendars) {
                if (starredCalendars === undefined) {
                    starredCalendars = [];
                }

                let indexToDelete = -1;
                starredCalendars.forEach(function(elem, i) {
                    if (elem.id === calendar.id) {
                        indexToDelete = i;
                    }
                });

                if (indexToDelete >= 0) {
                    starredCalendars.splice(indexToDelete, 1);
                    t.set('board', 'private', 'calendar_'+calendar.id, undefined)
                        .then(function() {
                            t.set('board', 'private', 'starred_calendars', starredCalendars);
                        });
                }
            });
    });
    iconWrapper.appendChild(icon);
    calendarElem.appendChild(iconWrapper);

    let metadataWrapper = document.createElement('div');
    let calendarName = document.createElement('b');
    calendarName.innerText = calendar.summary;
    let newLine = document.createElement('br');
    let name = document.createElement('em');
    name.innerText = email;
    metadataWrapper.appendChild(calendarName);
    metadataWrapper.appendChild(newLine);
    metadataWrapper.appendChild(name);
    calendarElem.appendChild(metadataWrapper);
    return calendarElem;
};

let generateGoogleAccountEntry = function(account) {
    // <div class="account-elem">
    //     <div class="trash-icon-wrapper">
    //         <span role="img" class="trash-icon input-icon"></span>
    //     </div>
    //     <div>
    //         <b>gui77aume.fournier@gmail.com</b>
    //         <br>
    //         <em>Guillaume Fournier</em>
    //     </div>
    // </div>
    let accountEntry = document.createElement('div');
    accountEntry.classList.add('account-elem');
    let iconWrapper = document.createElement('div');
    iconWrapper.classList.add("trash-icon-wrapper");
    let icon = document.createElement('span');
    icon.role = "img";
    icon.classList.add("trash-icon");
    icon.classList.add("input-icon");
    icon.addEventListener('click', function(evt) {
        t.get('board', 'private', 'google_accounts')
            .then(function(accounts) {
                if (accounts === undefined) {
                    accounts = [];
                }

                let indexToDelete = -1;
                accounts.forEach(function(email, i) {
                    if (email === account.email) {
                        indexToDelete = i;
                    }
                });

                if (indexToDelete >= 0) {
                    accounts.splice(indexToDelete, 1);
                    t.set('board', 'private', account.email, undefined)
                        .then(function() {
                            t.set('board', 'private', 'google_accounts', accounts);
                        });
                }
            });
    });
    iconWrapper.appendChild(icon);
    accountEntry.appendChild(iconWrapper);

    let metadataWrapper = document.createElement('div');
    let email = document.createElement('b');
    email.innerText = account.email;
    let newLine = document.createElement('br');
    let name = document.createElement('em');
    name.innerText = account.name;
    metadataWrapper.appendChild(email);
    metadataWrapper.appendChild(newLine);
    metadataWrapper.appendChild(name);
    accountEntry.appendChild(metadataWrapper);
    return accountEntry;
};

document.getElementById('google_api_key').addEventListener('change', function(){
    return t.set('board', 'shared', 'google_api_key', inputGoogleAPIKey.value);
});

document.getElementById('show_google_api_key').addEventListener('mousedown', function(){
    inputGoogleAPIKey.type = "text"
});

document.getElementById('show_google_api_key').addEventListener('mouseup', function(){
    inputGoogleAPIKey.type = "password"
});

save.addEventListener('click', function() {
    return t.set('board', 'shared', 'google_api_key', inputGoogleAPIKey.value);
});

googleMapsAutocomplete.addEventListener('click', function() {
    t.get('board', 'shared', 'google_maps_autocomplete')
        .then(function(autocompleteEnabled) {
            if (autocompleteEnabled === undefined) {
                autocompleteEnabled = true;
            } else {
                autocompleteEnabled = !autocompleteEnabled;
            }
            t.set('board', 'shared', 'google_maps_autocomplete', autocompleteEnabled);
        });
});

addGoogleAccountButton.addEventListener('click', function() {
    return t.popup({
        title: 'Add a Google Account',
        url: '../google-account-chooser/account-chooser.html',
        height: 120,
        args: {
            callback: "settings",
        },
    });
});

addStarredGoogleCalendarButton.addEventListener('click', function() {
    return t.popup({
        title: 'Add a Google Account',
        url: '../google-account-chooser/account-chooser.html',
        height: 120,
        args: {
            callback: "choose_calendar_and_starr_calendar",
        },
    });
});

cardArchiverDestinationBoardInput.addEventListener('click', function(evt) {
    t.popup({
        title: 'Choose a board',
        items: function(t, options) {
            return new Promise(async function(resolve) {
                await t.member('all')
                    .then(function(me) {
                        getBoards(t, me.id)
                            .then(function(boards) {
                                let items = [{
                                    text: "Remove board",
                                    callback: function (t, opt) {
                                        t.set('board', 'shared', 'archive_board', undefined)
                                            .then(function() {
                                                return t.popup({
                                                    title: 'Settings',
                                                    url: '../settings/settings.html',
                                                    height: 200,
                                                });
                                            });
                                    },
                                }];
                                boards.forEach(function(board) {
                                    if (options.search === undefined || options.search === '' || board.name.includes(options.search)) {
                                        items.push({
                                            text: board.name,
                                            callback: function (t, opt) {
                                                t.set('board', 'shared', 'archive_board', {
                                                    id: board.id,
                                                    name: board.name,
                                                })
                                                    .then(function() {
                                                        return t.popup({
                                                            title: 'Settings',
                                                            url: '../settings/settings.html',
                                                            height: 200,
                                                        });
                                                    });
                                            },
                                        });
                                    }
                                });
                                resolve(items);
                            });
                    });
            });
        },
        search: {
            debounce: 300,
            placeholder: 'Trello board',
            empty: 'No Trello board found',
            searching: 'Searching Trello...'
        }
    });
});

cardArchiverDoneListInput.addEventListener('click', function() {
    t.popup({
        title: 'Choose a list',
        items: function(t, options) {
            return new Promise(async function(resolve) {
                await t.board('all')
                    .then(function(board) {
                        getLists(t, board.id)
                            .then(function(lists) {
                                let items = [{
                                    text: "Remove list",
                                    callback: function (t, opt) {
                                        t.set('board', 'shared', 'archive_list', undefined)
                                            .then(function() {
                                                return t.popup({
                                                    title: 'Settings',
                                                    url: '../settings/settings.html',
                                                    height: 200,
                                                });
                                            });
                                    },
                                }];
                                lists.forEach(function(list) {
                                    if (options.search === undefined || options.search === '' || list.name.includes(options.search)) {
                                        items.push({
                                            text: list.name,
                                            callback: function (t, opt) {
                                                t.set('board', 'shared', 'archive_list', {
                                                    id: list.id,
                                                    name: list.name,
                                                })
                                                    .then(function() {
                                                        return t.popup({
                                                            title: 'Settings',
                                                            url: '../settings/settings.html',
                                                            height: 200,
                                                        });
                                                    });
                                            },
                                        });
                                    }
                                });
                                resolve(items);
                            });
                    });
            });
        },
        search: {
            debounce: 300,
            placeholder: 'Trello list',
            empty: 'No Trello list found',
            searching: 'Searching Trello...'
        }
    });
});

authorizeButton.addEventListener('click', async function() {
    return await t.popup({
        title: `Authorize ${WillPowerUpAppName}`,
        url: '../authorize-trello/authorize.html',
        height: 120,
        args: {
            callback: "settings",
        },
    });
});

googleCalendarSyncTimeLimit.addEventListener('click', function() {
    t.popup({
        title: 'Choose a limit',
        items: function(t, options) {
            return new Promise(async function(resolve) {
                let items = [];
                let elems = [
                    {
                        name: "1 day",
                        value: 1,
                    }, {
                        name: "1 week",
                        value: 7,
                    }, {
                        name: "1 month",
                        value: 30,
                    }, {
                        name: "3 month",
                        value: 90,
                    }, {
                        name: "6 months",
                        value: 180,
                    }, {
                        name: "1 year",
                        value: 360,
                    }
                ];
                elems.forEach(function(elem) {
                    items.push({
                        text: elem.name,
                        callback: function (t, opt) {
                            t.set('board', 'shared', 'google_calendar_sync_time_limit', elem)
                                .then(function() {
                                    return t.popup({
                                        title: 'Settings',
                                        url: '../settings/settings.html',
                                        height: 200,
                                    });
                                });
                        },
                    });
                });
                resolve(items);
            });
        },
    });
});
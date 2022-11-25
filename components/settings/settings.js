let t = TrelloPowerUp.iframe();
let inputGoogleAPIKey = document.getElementById('google_api_key');
let save = document.getElementById('save');
let googleMapsAutocomplete = document.getElementById('google_maps_autocomplete');
let googleCalendarsSection = document.getElementById('google_calendars_section');
let googleCalendarsList = document.getElementById('google_calendars_list');
let googleAccountsList = document.getElementById('google_accounts_list');
let addGoogleAccountButton = document.getElementById('add_google_account');

t.render(function(){
    t.get('board', 'shared', 'google_api_key')
        .then(function(google_api_key) {
            if (google_api_key !== undefined) {
                inputGoogleAPIKey.value = google_api_key;
            }
            t.get('board', 'shared', 'google_maps_autocomplete')
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
        .then(async function() {
            await t.get('board', 'private', 'google_accounts')
                .then(async function(accounts) {
                    if (accounts === undefined) {
                        accounts = [];
                    }

                    googleAccountsList.innerHTML = '';
                    for (const email of accounts) {
                        await t.get('board', 'private', email)
                            .then(function(account) {
                                if (account !== undefined) {
                                    let node = generateGoogleAccountEntry(account);
                                    googleAccountsList.appendChild(node);
                                }
                            });
                    }

                    await t.get('board', 'private', 'starred_calendars')
                        .then(async function(starredCalendars) {
                            if (starredCalendars === undefined) {
                                starredCalendars = [];
                            }

                            if (starredCalendars.length === 0) {
                                googleCalendarsSection.style.display = "none";
                            } else {
                                googleCalendarsSection.style.display = "block";
                            }

                            googleCalendarsList.innerHTML = '';
                            for (const starredCalendar of starredCalendars) {
                                await t.get('board', 'private', 'calendar_'+starredCalendar.id)
                                    .then(function(calendar) {
                                        if (calendar !== undefined) {
                                            let node = generateGoogleCalendarEntry(calendar, starredCalendar.email);
                                            googleCalendarsList.appendChild(node);
                                        }
                                    });
                            }
                        });
                })
        })
        .then(function(){
           t.sizeTo('#settings').catch(function() {});
        });
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
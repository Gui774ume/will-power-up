import { getGoogleAccountToken } from "../google-account-chooser/account-helper.js";

const googleContactsReadMask = "addresses,birthdays,biographies,emailAddresses,events,names,phoneNumbers,photos,relations,organizations,memberships";

export const prepareSearchContacts = function(t, selectedEmail) {
    return new Promise(function(resolve) {
        // lookup account token
        getGoogleAccountToken(t, selectedEmail)
            .then(async function (token) {
                if (token == null) {
                    return t.popup({
                        title: 'Choose a Google Account',
                        url: '../google-account-chooser/account-chooser.html',
                        height: 120,
                        args: {
                            callback: "prepare_search_contacts",
                            emailHint: selectedEmail,
                        },
                    });
                }

                searchContacts(t, token, selectedEmail)
                    .then(async function(contact) {
                        if (contact !== undefined && contact.resourceName !== undefined) {
                            // update internal contact data
                            contact.lastUpdate = new Date().toLocaleDateString(navigator.language);
                            contact.visible = true;
                            await t.set('card', 'shared', `contact`, minimizeGoogleContact(contact));
                        }
                        resolve();
                    });
            });
    });
};

export const searchContacts = function(t, token, selectedEmail) {
    return new Promise(async function(resolve) {
        let account = {};
        await t.get('board', 'private', selectedEmail)
            .then(function(googleAccount) {
                account = googleAccount;
            });

            // open Calendar chooser popup
            t.popup({
                title: 'Choose a contact',
                items: function (t, options) {
                    return new Promise(async function (searchResolve) {
                        // use the provided token
                        gapi.client.setToken(token);

                        try {
                            // request calendar list
                            let contacts = await gapi.client.people.people.searchContacts({
                                pageSize: 10,
                                query: options.search,
                                readMask: googleContactsReadMask,
                            });

                            let out = [];

                            if (contacts === undefined || contacts.result === undefined || contacts.result.results === undefined) {
                                contacts = {
                                    result: {
                                        results: [],
                                    }
                                }
                            }

                            // check if we should query the directory
                            if (account.organizations !== undefined && account.organizations.length > 0) {
                                let directoryContacts = await gapi.client.people.people.searchDirectoryPeople({
                                    pageSize: 10,
                                    query: options.search === "" || options.search === undefined ? " " : options.search,
                                    readMask: googleContactsReadMask,
                                    sources: ['DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE'],
                                })

                                // This won't work until the following issue is resolved: https://issuetracker.google.com/issues/196235775
                                // There is a bug on Google's API side that prevents the exportation of the names of a directory contact ...

                                if (directoryContacts !== undefined && directoryContacts.result !== undefined && directoryContacts.result.people !== undefined) {
                                    directoryContacts.result.people.forEach(elem => {
                                        contacts.result.results.push({
                                            person: elem,
                                        });
                                    });
                                }
                            }

                            if (contacts.result.results.length === 0) {
                                return searchResolve(out);
                            }

                            contacts.result.results.filter(function (elem) {
                                return !(elem.person === undefined || elem.person.names === undefined || elem.person.names.length === 0);
                            }).map(function (elem) {
                                let displayName = "No name";
                                for (const name of elem.person.names) {
                                    if (name.displayName === undefined) {
                                        continue;
                                    }
                                    displayName = name.displayName;
                                    break;
                                }
                                return {
                                    text: displayName,
                                    callback: async function (t, opts) {
                                        // fetch labels
                                        if (elem.person.memberships !== undefined) {
                                            for (const [i, membership] of elem.person.memberships.entries()) {
                                                let label = await gapi.client.people.contactGroups.get({
                                                    resourceName: membership.contactGroupMembership.contactGroupResourceName,
                                                })
                                                if (label !== undefined && label.result !== undefined) {
                                                    elem.person.memberships[i].formattedName = label.result.formattedName;
                                                }
                                            }
                                        }
                                        resolve(elem.person);
                                    },
                                };
                            }).forEach(function (elem) {
                                out.push(elem);
                            });
                            searchResolve(out);

                        } catch (resp) {
                            let msg = ''
                            if (resp.result !== undefined && resp.result.error !== undefined) {
                                msg = resp.result.error.message;
                            } else {
                                msg = "see console";
                                console.log(resp);
                            }
                            setTimeout(function() {
                                t.alert({
                                    message: `Couldn't list contacts: ${msg}`,
                                    duration: 6,
                                });
                            }, 1000);
                        }
                    });
                },
                search: {
                    debounce: 300,
                    placeholder: 'Search Google Contacts',
                    empty: 'No contact found',
                    searching: 'Searching Google Contacts ...'
                }
            });
    });
};

export const getPrimaryOrganization = function(contact) {
    if (contact === undefined || contact.organizations === undefined) {
        return undefined;
    }
    for (const org of contact.organizations) {
        if (org.metadata.primary) {
            return {
                name: org.name,
                title: org.title,
            }
        }
    }
    return undefined;
}

export const getPrimaryName = function(contact) {
    if (contact === undefined || contact.names === undefined) {
        return undefined;
    }
    for (const elem of contact.names) {
        if (elem.metadata.primary) {
            return {
                displayName: elem.displayName,
            }
        }
    }
    return undefined;
}

export const getPrimaryPhoto = function(contact) {
    if (contact === undefined || contact.photos === undefined) {
        return undefined;
    }
    for (const elem of contact.photos) {
        if (elem.metadata.primary) {
            return {
                url: elem.url,
            }
        }
    }
    return undefined;
}

export const getPrimaryBirthday = function(contact) {
    if (contact === undefined || contact.birthdays === undefined) {
        return undefined;
    }
    for (const elem of contact.birthdays) {
        if (elem.metadata.primary) {
            return {
                date: elem.date,
            }
        }
    }
    return undefined;
}

export const getPrimaryBiography = function(contact) {
    if (contact === undefined || contact.biographies === undefined) {
        return undefined;
    }
    for (const elem of contact.biographies) {
        if (elem.metadata.primary) {
            return {
                value: elem.value,
            }
        }
    }
    return undefined;
}

let minimizeGoogleContact = function(contact) {
    let minimizedContact = {
        resourceName: contact.resourceName,
        visible: contact.visible,
        lastUpdate: contact.lastUpdate,
        biography: getPrimaryBiography(contact),
        birthday: getPrimaryBirthday(contact),
        name: getPrimaryName(contact),
        organization: getPrimaryOrganization(contact),
        photo: getPrimaryPhoto(contact),
        addresses: [],
        emailAddresses: [],
        events: [],
        memberships: [],
        phoneNumbers: [],
        relations: [],
    };

    if (contact.addresses !== undefined) {
        for (const address of contact.addresses) {
            minimizedContact.addresses.push({
                city: address.city,
                country: address.country,
                formattedType: address.formattedType,
                postalCode: address.postalCode,
                streetAddress: address.streetAddress,
            });
        }
    }

    if (contact.emailAddresses !== undefined) {
        for (const email of contact.emailAddresses) {
            minimizedContact.emailAddresses.push({
                formattedType: email.formattedType,
                value: email.value,
            });
        }
    }

    if (contact.events !== undefined) {
        for (const event of contact.events) {
            minimizedContact.events.push({
                date: event.date,
                formattedType: event.formattedType,
            });
        }
    }

    if (contact.memberships !== undefined) {
        for (const membership of contact.memberships) {
            minimizedContact.memberships.push({
                formattedName: membership.formattedName,
            });
        }
    }

    if (contact.phoneNumbers !== undefined) {
        for (const phoneNumber of contact.phoneNumbers) {
            minimizedContact.phoneNumbers.push({
                canonicalForm: phoneNumber.canonicalForm,
                formattedType: phoneNumber.formattedType,
            });
        }
    }

    if (contact.relations !== undefined) {
        for (const relation of contact.relations) {
            minimizedContact.relations.push({
                formattedType: relation.formattedType,
                person: relation.person,
            });
        }
    }

    return minimizedContact;
}
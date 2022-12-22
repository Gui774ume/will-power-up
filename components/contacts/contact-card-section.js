import { resetCardSectionHeight } from "../card-section/card-section.js";
import { sanitizeInput } from "../../service/utils.js";
import { putCardDescription } from "../../service/api.js";

let t = TrelloPowerUp.iframe();
var Promise = TrelloPowerUp.Promise;
let contactSectionWrapper = document.getElementById('contact_section_wrapper');
let contactNode = document.getElementById('contact');
let removeContactButton = document.getElementById('remove_contact_button');
let hideContactButton = document.getElementById('hide_contact_button');
let attachContactToCardButton = document.getElementById('attach_contact_button');

let hideContactSection = function() {
    contactSectionWrapper.style.display = 'none';
}

let showContactSection = function() {
    contactSectionWrapper.style.display = 'block';
}

let hideContact = function() {
    // hide the contact
    contactNode.style.display = 'none';
    // change icon
    hideContactButton.classList.add("mod-primary");
}

let showContact = function() {
    // show the contact
    contactNode.style.display = 'block';
    // change icon
    hideContactButton.classList.remove("mod-primary");
}

hideContactButton.addEventListener('click', async function(evt) {
    hideContactButton.disabled = true;

    await t.get('card', 'shared', 'contact')
        .then(async function(contact) {
            if (contact === undefined) {
                // should never happen
                return;
            }
            if (contact.visible) {
                hideContact();
                // update contact visibility
                contact.visible = false;
            } else {
                showContact();
                // update contact visibility
                contact.visible = true;
            }

            await t.set('card', 'shared', 'contact', contact);
        });

    hideContactButton.disabled = false;
    await resetCardSectionHeight();
});

removeContactButton.addEventListener('click', function(evt) {
    t.set('card', 'shared', 'contact', undefined);
});

export const renderContactSection = function(){
    return new Promise(async function(resolve) {
        let contact = undefined;
        await t.get('card', 'shared', 'contact')
            .then(function (cardContact) {
                contact = cardContact;
            });

        if (contact === undefined) {
            hideContactSection();
            resolve();
            return;
        } else {
            showContactSection();
        }

        if (!contact.visible) {
            hideContact();
        }

        let node = generateContactNode(contact);
        contactNode.innerHTML = '';
        contactNode.appendChild(node);

        await resetCardSectionHeight();
    });
};

let generateContactNode = function(contact) {
    // <div className="contact-wrapper">
    // [...]
    // </div>
    let wrapper = document.createElement('div');
    wrapper.classList.add('contact-wrapper');

    //     <div className="contact-header-wrapper">
    //         <div>
    //             <img className="contact-photo"
    //                  src="">
    //         </div>
    //         <div>
    //             <div className="contact-header">
    //                 <h2 style="margin-bottom: 3px">My Name</h2>
    //                 <span>Hello</span> • <span>Paris</span>
    //                 <br>
    //                 <em>Last updated on ...</em>
    //             </div>
    //         </div>
    //     </div>
    let headerWrapper = document.createElement('div');
    headerWrapper.classList.add('contact-header-wrapper');
    let photoWrapper = document.createElement('div');
    let photo = document.createElement('img');
    photo.classList.add('contact-photo');
    if (contact.photo !== undefined) {
        photo.src = contact.photo.url.replace("s100", "s1000");
    }
    photoWrapper.appendChild(photo);
    headerWrapper.appendChild(photoWrapper);
    let header = document.createElement('div');
    let contactHeader = document.createElement('div');
    contactHeader.classList.add('contact-header');
    contactHeader.addEventListener('click', function(evt) {
        let personID = contact.resourceName.replace('people/', '');
        window.open(`https://contacts.google.com/person/${personID}`, '_blank').focus();
    });
    let name = document.createElement('h2');
    name.style.marginBottom = '3px';
    if (contact.name !== undefined) {
        name.innerText = contact.name.displayName;
    }
    contactHeader.appendChild(name);
    if (contact.organization !== undefined) {
        if (contact.organization.name !== '') {
            let orgName = document.createElement('span');
            orgName.innerText = contact.organization.name;
            contactHeader.appendChild(orgName);
        }
        if (contact.organization.title !== '') {
            let orgTitle = document.createElement('span');
            if (contact.organization.name !== '') {
                orgTitle.innerText = ' • ';
            }
            orgTitle.innerText += contact.organization.title;
            contactHeader.appendChild(orgTitle);
        }
        if (contact.organization.name !== '' || contact.organization.title !== '') {
            let orgNewLine = document.createElement('br');
            contactHeader.appendChild(orgNewLine);
        }
    }
    let lastUpdated = document.createElement('em');
    lastUpdated.innerText = `Last updated on ${contact.lastUpdate}`;
    contactHeader.appendChild(lastUpdated);
    let labelsWrapper = document.createElement('div');
    labelsWrapper.classList.add('contact-detail-wrapper');
    labelsWrapper.style.marginBottom = '0px';
    if (contact.memberships !== undefined) {
        for (const membership of contact.memberships) {
            let label = document.createElement('div');
            label.classList.add('contact-label');
            label.innerText = membership.formattedName;
            labelsWrapper.appendChild(label);
        }
    }
    contactHeader.appendChild(labelsWrapper);
    header.appendChild(contactHeader);
    headerWrapper.appendChild(header);
    wrapper.appendChild(headerWrapper);

    let contactEmails = contact.emailAddresses;
    if (contactEmails !== undefined && contactEmails.length > 0) {
        //     <div className="contact-detail-wrapper">
        //         <div className="contact-detail">
        //             <div className="contact-detail-icon-wrapper">
        //                 <span role="img" className="envelope-icon input-icon"></span>
        //             </div>
        //             <div>
        //                 <a className="contact-link" href="mailto:"
        //                    target="_blank"><span></span> • <span
        //                     className="contact-tag">Work</span></a>
        //             </div>
        //         </div>
        //         <div className="contact-detail-elem">
        //             <a className="contact-link" href="mailto:"
        //                target="_blank"><span></span> • <span
        //                 className="contact-tag">Home</span></a>
        //         </div>
        //     </div>
        let emailsNode = generateContactDetails('envelope-icon', contactEmails, emailNodeGenerator);
        wrapper.appendChild(emailsNode);
    }

    let contactPhoneNumbers = contact.phoneNumbers;
    if (contactPhoneNumbers !== undefined && contactPhoneNumbers.length > 0) {
        //     <div className="contact-detail-wrapper">
        //         <div>
        //             <div className="contact-detail">
        //                 <div className="contact-detail-icon-wrapper">
        //                     <span role="img" className="phone-icon input-icon"></span>
        //                 </div>
        //                 <div>
        //                     <a className="contact-link" href="tel:+33656457895"
        //                        target="_blank"><span>+33656457895</span> • <span className="contact-tag">Work</span></a>
        //                 </div>
        //             </div>
        //             <div className="contact-detail-elem">
        //                 <a className="contact-link" href="tel:+33656457895"
        //                    target="_blank"><span>+33656457895</span> • <span className="contact-tag">Home</span></a>
        //             </div>
        //         </div>
        //     </div>
        let phoneNumbersNode = generateContactDetails('phone-icon', contactPhoneNumbers, phoneNumberNodeGenerator, 'canonicalForm');
        wrapper.appendChild(phoneNumbersNode);
    }

    if (contact.birthday !== undefined) {
        //     <div className="contact-detail-wrapper">
        //         <div>
        //             <div className="contact-detail">
        //                 <div className="contact-detail-icon-wrapper">
        //                     <span role="img" className="cake-icon input-icon"></span>
        //                 </div>
        //                 <div>
        //                     <span>19 juin 1995</span>
        //                 </div>
        //             </div>
        //         </div>
        //     </div>
        let birthdayDetailWrapper = document.createElement('div');
        birthdayDetailWrapper.classList.add('contact-detail-wrapper');
        let birthdayWrapper = document.createElement('div');
        let birthday = document.createElement('div');
        birthday.classList.add('contact-detail');
        let birthdayIconWrapper = document.createElement('div');
        birthdayIconWrapper.classList.add('contact-detail-icon-wrapper');
        let icon = document.createElement('span');
        icon.role = 'img';
        icon.classList.add('cake-icon');
        icon.classList.add('input-icon');
        birthdayIconWrapper.appendChild(icon);
        birthday.appendChild(birthdayIconWrapper);
        let birthdayDateWrapper = document.createElement('div');
        let birthdayDate = document.createElement('span');
        birthdayDate.innerText = formatDate(contact.birthday.date);
        birthdayDateWrapper.appendChild(birthdayDate);
        birthday.appendChild(birthdayDateWrapper);
        birthdayWrapper.appendChild(birthday);
        birthdayDetailWrapper.appendChild(birthdayWrapper);
        wrapper.appendChild(birthdayDetailWrapper);
    }

    let contactLocations = contact.addresses;
    if (contactLocations !== undefined && contactLocations.length > 0) {
        //     <div className="contact-detail-wrapper">
        //         <div>
        //             <div className="contact-detail">
        //                 <div className="contact-detail-icon-wrapper">
        //                     <span role="img" className="location-dot-icon input-icon"></span>
        //                 </div>
        //                 <div>
        //                     <a className="contact-link" target="_blank"><span></span> • <span
        //                         className="contact-tag">Home</span></a> • <span className="contact-tag contact-link">Use as card location</span>
        //                 </div>
        //             </div>
        //             <div className="contact-detail-elem">
        //                 <a className="contact-link" target="_blank"><span></span> • <span
        //                     className="contact-tag">Home</span></a> • <span className="contact-tag contact-link">Use as card location</span>
        //             </div>
        //         </div>
        //     </div>
        let locationsNode = generateContactDetails('location-dot-icon', contactLocations, locationNodeGenerator);
        wrapper.appendChild(locationsNode);
    }

    let contactEvents = contact.events;
    if (contactEvents !== undefined && contactEvents.length > 0) {
        //     <div className="contact-detail-wrapper">
        //         <div>
        //             <div className="contact-detail">
        //                 <div className="contact-detail-icon-wrapper">
        //                     <span role="img" className="calendar-icon input-icon"></span>
        //                 </div>
        //                 <div>
        //                     <span></span> • <span className="contact-tag"></span>
        //                 </div>
        //             </div>
        //             <div className="contact-detail-elem">
        //                 <span></span> • <span className="contact-tag"></span>
        //             </div>
        //         </div>
        //     </div>
        let eventsNode = generateContactDetails('calendar-icon', contactEvents, eventNodeGenerator);
        wrapper.appendChild(eventsNode);
    }

    let contactRelations = contact.relations;
    if (contactRelations !== undefined && contactRelations.length > 0) {
        //     <div className="contact-detail-wrapper">
        //         <div>
        //             <div className="contact-detail">
        //                 <div className="contact-detail-icon-wrapper">
        //                     <span role="img" className="family-icon input-icon"></span>
        //                 </div>
        //                 <div>
        //                     <span></span> • <span className="contact-tag">Sister</span>
        //                 </div>
        //             </div>
        //             <div className="contact-detail-elem">
        //                 <span></span> • <span className="contact-tag">Brother</span>
        //             </div>
        //         </div>
        //     </div>
        let relationsNode = generateContactDetails('family-icon', contactRelations, relationNodeGenerator);
        wrapper.appendChild(relationsNode);
    }

    if (contact.biography !== undefined) {
        //     <div className="contact-detail-wrapper">
        //         <div className="contact-detail">
        //             <div className="contact-detail-icon-wrapper">
        //                 <span role="img" className="note-icon input-icon"></span>
        //             </div>
        //             <div>
        //                 <span>notes</span>
        //             </div>
        //         </div>
        //     </div>
        let biographiesWrapper = document.createElement('div');
        biographiesWrapper.classList.add('contact-detail-wrapper');
        let biographies = document.createElement('div');
        biographies.classList.add('contact-detail');
        let iconWrapper = document.createElement('div');
        iconWrapper.classList.add('contact-detail-icon-wrapper');
        let icon = document.createElement('span');
        icon.role = 'img';
        icon.classList.add('note-icon');
        icon.classList.add('input-icon');
        iconWrapper.appendChild(icon);
        biographies.appendChild(iconWrapper);
        let biography = document.createElement('div');
        let biographyContent = document.createElement('span');
        biographyContent.innerText = contact.biography.value;
        biography.appendChild(biographyContent);
        biographies.appendChild(biography);
        biographiesWrapper.appendChild(biographies);
        wrapper.appendChild(biographiesWrapper);
    }

    return wrapper;
};

let generateContactDetails = function(iconClass, elems, elemNodeGenerator, deduplicateField='') {
    let wrapper = document.createElement('div');
    wrapper.classList.add('contact-detail-wrapper');
    let allElems = document.createElement('div');

    let header = document.createElement('div');
    header.classList.add('contact-detail');
    let iconWrapper = document.createElement('div');
    iconWrapper.classList.add('contact-detail-icon-wrapper');
    let icon = document.createElement('span');
    icon.role = 'img';
    icon.classList.add(iconClass);
    icon.classList.add('input-icon');
    iconWrapper.appendChild(icon);
    header.appendChild(iconWrapper);

    let firstElemWrapper = document.createElement('div');
    let firstElem = elemNodeGenerator(elems[0]);
    firstElemWrapper.appendChild(firstElem);
    header.appendChild(firstElemWrapper);

    allElems.appendChild(header);

    let values = [];
    if (deduplicateField !== '') {
        values.push(elems[0][deduplicateField]);
    }

    for (const [i, elem] of elems.entries()) {
        if (i === 0) {
            continue;
        }

        if (deduplicateField !== '') {
            if (values.includes(elem[deduplicateField])) {
                continue;
            }
        }

        let elemWrapper = document.createElement('div');
        elemWrapper.classList.add('contact-detail-elem');
        let elemNode = elemNodeGenerator(elem);
        elemWrapper.appendChild(elemNode);
        allElems.appendChild(elemWrapper);
    }

    wrapper.appendChild(allElems);

    return wrapper;
};

let emailNodeGenerator = function(email) {
    // <a className="contact-link" href="mailto:" target="_blank"><span>email</span> • <span className="contact-tag">Type</span></a>
    let emailNode = document.createElement('a');
    emailNode.target = '_blank';
    emailNode.classList.add('contact-link');
    emailNode.href = `mailto:${email.value}`;
    let emailValue = document.createElement('span');
    emailValue.innerText = email.value;
    emailNode.appendChild(emailValue);
    if (email.formattedType !== undefined) {
        emailNode.innerText += ' • ';
        let label = document.createElement('span');
        label.classList.add('contact-tag');
        label.innerText = email.formattedType;
        emailNode.appendChild(label);
    }
    return emailNode;
}

let phoneNumberNodeGenerator = function(phoneNumber) {
    // <a className="contact-link" href="tel:+33656457895" target="_blank"><span>+33656457895</span> • <span className="contact-tag">Work</span></a>
    let phoneNode = document.createElement('a');
    phoneNode.target = '_blank';
    phoneNode.classList.add('contact-link');
    phoneNode.href = `tel:${phoneNumber.canonicalForm}`;
    let phoneValue = document.createElement('span');
    phoneValue.innerText = phoneNumber.canonicalForm;
    phoneNode.appendChild(phoneValue);
    if (phoneNumber.formattedType !== undefined) {
        phoneNode.innerText += ' • ';
        let label = document.createElement('span');
        label.classList.add('contact-tag');
        label.innerText = phoneNumber.formattedType;
        phoneNode.appendChild(label);
    }
    return phoneNode;
}

let locationNodeGenerator = function(location) {
    // <a className="contact-link" target="_blank"><span></span> • <span className="contact-tag">Home</span></a> • <span className="contact-tag contact-link">Use as card location</span>
    let locationString = (location.streetAddress !== undefined ? location.streetAddress : '') + ', ' + (location.postalCode !== undefined ? location.postalCode : '') + ', ' + (location.city !== undefined ? location.city : '') + ' ' + (location.country !== undefined ? location.country : '');
    let wrapper = document.createElement('span');
    let node = document.createElement('a');
    node.classList.add('contact-link');
    node.target = '_blank';
    node.href = `https://maps.google.com/?q=${sanitizeInput(locationString)}`;
    let nodeValue = document.createElement('span');
    nodeValue.innerText = locationString;
    node.appendChild(nodeValue);
    if (location.formattedType !== undefined) {
        let separator = document.createElement('span');
        separator.innerText = ' • ';
        node.appendChild(separator);
        let label = document.createElement('span');
        label.classList.add('contact-tag');
        label.innerText = location.formattedType;
        node.appendChild(label);
    }
    wrapper.appendChild(node);

    let separator = document.createElement('span');
    separator.innerText = ' • ';
    wrapper.appendChild(separator);

    let useAs = document.createElement('span');
    useAs.classList.add('contact-tag');
    useAs.classList.add('contact-link');
    useAs.innerText = 'Use as card location';
    useAs.addEventListener('click', async function(evt) {
        await t.set('card', 'shared', 'map_origin', {
            description: locationString,
            place_id: "",
        });
        await t.set('card', 'shared', 'map_destination', {
            description: "",
            place_id: "",
        });
    });
    wrapper.appendChild(useAs);
    return wrapper;
};

let eventNodeGenerator = function(event) {
    // <span></span> • <span className="contact-tag"></span>
    let wrapper = document.createElement('span');
    let dateNode = document.createElement('span');
    dateNode.innerText = formatDate(event.date);
    wrapper.appendChild(dateNode);
    if (event.formattedType !== undefined) {
        let separator = document.createElement('span');
        separator.innerText = ' • ';
        wrapper.appendChild(separator);
        let label = document.createElement('span');
        label.classList.add('contact-tag');
        label.innerText = event.formattedType;
        wrapper.appendChild(label);
    }
    return wrapper;
};

let formatDate = function(inputDate) {
    let parsedDate = new Date();
    let options = {};
    if (inputDate.day !== undefined) {
        parsedDate.setDate(inputDate.day);
        options.day = "numeric";
    }
    if (inputDate.month !== undefined) {
        parsedDate.setMonth(inputDate.month - 1);
        options.month = "long";
    }
    if (inputDate.year !== undefined) {
        parsedDate.setFullYear(inputDate.year);
        options.year = "numeric";
    }
    return parsedDate.toLocaleDateString(navigator.language, options);
};

let relationNodeGenerator = function(relation) {
    // <span></span> • <span className="contact-tag"></span>
    let wrapper = document.createElement('span');
    let node = document.createElement('span');
    node.innerText = relation.person;
    wrapper.appendChild(node);
    if (relation.formattedType !== undefined) {
        let separator = document.createElement('span');
        separator.innerText = ' • ';
        wrapper.appendChild(separator);
        let label = document.createElement('span');
        label.classList.add('contact-tag');
        label.innerText = relation.formattedType;
        wrapper.appendChild(label);
    }
    return wrapper;
};

attachContactToCardButton.addEventListener('click', async function(evt) {
    let card = {};
    await t.card('id', 'desc')
        .then(function(trelloCard) {
            card = trelloCard;
        });

    await t.get('card', 'shared', 'contact')
        .then(async function(contact) {
            // attach profile picture
            t.attach({
                name: contact.name.displayName,
                url: contact.photo.url.replace("s100", "s1000"),
            });

            let description = card.desc === '' ? generateDescriptionFromContact(contact) : card.desc + '\n\n' + generateDescriptionFromContact(contact);

            // set card description
            await putCardDescription(t, card.id, description);
        });
});

let generateDescriptionFromContact = function(contact) {
    let markdownOutput = '';
    if (contact.name !== undefined) {
        markdownOutput += `## ${contact.name.displayName}\n\n`
        let org = '';
        if (contact.organization !== undefined) {
            if (contact.organization.name !== undefined) {
                org += contact.organization.name;
            }
            if (contact.organization.title !== undefined) {
                if (contact.organization.name !== undefined) {
                    org += ' • ';
                }
                org += contact.organization.title;
            }
        }
        if (org !== '') {
            org += ' • ';
        }
        org += `Last updated on ${contact.lastUpdate}`;
        markdownOutput += `_${org}_\n\n`;
    }
    if (contact.memberships !== undefined) {
        let labels = '';
        for (const [i, membership] of contact.memberships.entries()) {
            if (i > 0) {
                labels += ', ';
            }
            labels += membership.formattedName;
        }
        if (labels !== '') {
            markdownOutput += `Labels: ${labels}\n\n`;
        }
    }

    if (contact.emailAddresses !== undefined && contact.emailAddresses.length > 0) {
        markdownOutput += "#### Emails\n\n";
        for (const email of contact.emailAddresses) {
            markdownOutput += `- [${email.value}](mailto:${email.value})`;
            if (email.formattedType !== undefined) {
                markdownOutput += ` • ${email.formattedType}`;
            }
            markdownOutput += '\n';
        }
        markdownOutput += '\n\n';
    }

    if (contact.phoneNumbers !== undefined && contact.phoneNumbers.length > 0) {
        markdownOutput += "#### Phone numbers\n\n";
        let values = [];
        for (const elem of contact.phoneNumbers) {
            if (values.includes(elem.canonicalForm)) {
                continue;
            }
            values.push(elem.canonicalForm);
            markdownOutput += `- [${elem.canonicalForm}](tel:${elem.canonicalForm})`;
            if (elem.formattedType !== undefined) {
                markdownOutput += ` • ${elem.formattedType}`;
            }
            markdownOutput += '\n';
        }
        markdownOutput += '\n\n';
    }

    if (contact.birthday !== undefined) {
        markdownOutput += "#### Birthday\n\n";
        markdownOutput += formatDate(contact.birthday.date);
        markdownOutput += '\n\n';
    }

    if (contact.addresses !== undefined && contact.addresses.length > 0) {
        markdownOutput += "#### Addresses\n\n";
        for (const address of contact.addresses) {
            let locationString = (address.streetAddress !== undefined ? address.streetAddress : '') + ', ' + (address.postalCode !== undefined ? address.postalCode : '') + ', ' + (address.city !== undefined ? address.city : '') + ' ' + (address.country !== undefined ? address.country : '');
            markdownOutput += `- [${locationString}](https://maps.google.com/?q=${sanitizeInput(locationString)})`;
            if (address.formattedType !== undefined) {
                markdownOutput += ` • ${address.formattedType}`;
            }
            markdownOutput += '\n';
        }
        markdownOutput += '\n\n';
    }

    if (contact.events !== undefined && contact.events.length > 0) {
        markdownOutput += "#### Events\n\n";
        for (const elem of contact.events) {
            markdownOutput += `- ${formatDate(elem.date)}`;
            if (elem.formattedType !== undefined) {
                markdownOutput += ` • ${elem.formattedType}`;
            }
            markdownOutput += '\n';
        }
        markdownOutput += '\n\n';
    }

    if (contact.relations !== undefined && contact.relations.length > 0) {
        markdownOutput += "#### Relations\n\n";
        for (const elem of contact.relations) {
            markdownOutput += `- ${elem.person}`;
            if (elem.formattedType !== undefined) {
                markdownOutput += ` • ${elem.formattedType}`;
            }
            markdownOutput += '\n';
        }
        markdownOutput += '\n\n';
    }

    if (contact.biography !== undefined) {
        markdownOutput += "#### Note\n\n";
        markdownOutput += contact.biography.value;
        markdownOutput += '\n\n';
    }

    // add divider
    markdownOutput += '---';
    return markdownOutput
}
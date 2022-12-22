import { WillPowerUpAppKey } from "../constants.js";
import { sendRequest } from "./requests.js";
import { getTrelloToken } from "./auth.js";

const buildTrelloRequest = function(token, resource, params={}) {
    return `https://api.trello.com/1${resource}?key=${WillPowerUpAppKey}&token=${token}${serializeParams(params)}`;
};

export const serializeParams = function(obj) {
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
                        console.log(err);
                        resolve(undefined);
                    })
            });
    });
}

export const putScopedCardData = async function(t, cardInput) {
    // update location data
    await t.set('card', 'shared', 'map_origin', {
        description: cardInput.location,
        place_id: "",
    });
    await t.set('card', 'shared', 'map_destination', {
        description: "",
        place_id: "",
    });

    // set duration
    if (cardInput.duration > 0) {
        await t.set('card', 'shared', 'duration', {
            name: `${cardInput.duration} minutes`,
            value: cardInput.duration,
        });
    }

    // etag
    if (cardInput.etag !== undefined) {
        await t.set('card', 'shared', 'etag', cardInput.etag);
    }
}

export const putCardDescription = async function(t, id, description) {
    return new Promise(function(resolve) {
        getTrelloToken(t)
            .then(async function(token) {
                let input = {
                    desc: description,
                };
                sendRequest(buildTrelloRequest(token, `/cards/${id}`, input), "PUT")
                    .then(async function(card) {
                        resolve(card);
                    })
                    .catch(function(err) {
                        console.log(err);
                        resolve(undefined);
                    })
            });
    });

}

export const putCard = async function(t, id, cardInput, hasCardInContext) {
    // check if card namespace data should be updated
    if (hasCardInContext) {
        await putScopedCardData(t, cardInput)
    }
    return new Promise(function(resolve, reject) {
        getTrelloToken(t)
            .then(async function(token) {
                let input = {
                    name: cardInput.name,
                    desc: cardInput.description,
                    start: cardInput.start,
                    due: cardInput.due,
                };
                if (cardInput.labels !== undefined && cardInput.labels.length > 0) {
                    input.idLabels = cardInput.labels.map(label => {return label.id});
                }
                sendRequest(buildTrelloRequest(token, `/cards/${id}`, input), "PUT")
                    .then(async function(card) {
                        let promisesList = [];
                        if (card.attachments === undefined) {
                            card.attachments = [];
                        }

                        // fetch card attachments
                        promisesList.push(sendRequest(buildTrelloRequest(token, `/cards/${card.id}/attachments`))
                            .then(async function(attachments) {
                                for (const attachment of attachments) {
                                    for (const [i, updatedAttachment] of cardInput.attachments.entries()) {
                                        // a card can be synced with multiple calendars, make sure to select the right one
                                        let params = new URLSearchParams(attachment.url);
                                        if (params.get('calendarID') !== updatedAttachment.calendarID) {
                                            continue;
                                        }

                                        if (attachment.id === updatedAttachment.id || ((updatedAttachment.id === '' || updatedAttachment.id === undefined) && attachment.name === updatedAttachment.name)) {
                                            // delete attachment
                                            promisesList.push(sendRequest(buildTrelloRequest(token, `/cards/${card.id}/attachments/${attachment.id}`), "DELETE")
                                                .catch(function(err) {
                                                    console.log(err);
                                                }));
                                            // recreate new one
                                            promisesList.push(sendRequest(buildTrelloRequest(token, `/cards/${card.id}/attachments`, {
                                                name: updatedAttachment.name,
                                                url: updatedAttachment.url,
                                            }), "POST")
                                                .then(function(newAttachment) {
                                                    card.attachments.push(newAttachment);
                                                })
                                                .catch(function(err) {
                                                    console.log(err);
                                                }));
                                            // pop attachment from the attachments to update
                                            cardInput.attachments.splice(i, 1);
                                            // break out of the current loop
                                            break;
                                        } else {
                                            card.attachments.push(attachment);
                                        }
                                    }
                                }

                                // create all remaining attachments
                                for (const attachment of cardInput.attachments) {
                                    promisesList.push(sendRequest(buildTrelloRequest(token, `/cards/${card.id}/attachments`, {
                                        name: attachment.name,
                                        url: attachment.url,
                                    }), "POST")
                                        .then(function(newAttachment) {
                                            card.attachments.push(newAttachment)
                                        })
                                        .catch(function(err) {
                                            console.log(err);
                                        }));
                                }
                            }));

                        // wait for all promises
                        await Promise.all(promisesList);

                        resolve(card);
                    })
                    .catch(function(err) {
                        console.log(err);
                        resolve(undefined);
                    })
            });
    });
}

export const postCard = function(t, cardInput) {
    return new Promise(function(resolve, reject) {
        getTrelloToken(t)
            .then(async function(token) {
                let input = {
                    name: cardInput.name,
                    desc: cardInput.description,
                    idList: cardInput.idList,
                    start: cardInput.start,
                    due: cardInput.due,
                };
                if (cardInput.labels !== undefined && cardInput.labels.length > 0) {
                    input.idLabels = cardInput.labels.map(label => {return label.id});
                }
                sendRequest(buildTrelloRequest(token, `/cards`, input), "POST")
                    .then(async function(card) {
                        let promisesList = [];
                        if (card.attachments === undefined) {
                            card.attachments = [];
                        }

                        // add attachment
                        for (const attachment of cardInput.attachments) {
                            promisesList.push(sendRequest(buildTrelloRequest(token, `/cards/${card.id}/attachments`, {
                                name: attachment.name,
                                url: attachment.url,
                            }), "POST")
                                .then(function(newAttachment) {
                                    card.attachments.push(newAttachment);
                                })
                                .catch(function(err) {
                                    console.log(err);
                                }));
                        }

                        // wait for all promises
                        await Promise.all(promisesList);

                        resolve(card);
                    })
                    .catch(function(err) {
                        console.log(err);
                        resolve(undefined);
                    })
            });
    });
}

export const getBoards = function(t, memberID) {
    return new Promise(function(resolve, reject) {
        getTrelloToken(t)
            .then(function(token) {
                sendRequest(buildTrelloRequest(token, `/members/${memberID}/boards`))
                    .then(function(boards) {
                        resolve(boards);
                    })
                    .catch(function(err) {
                        console.log(err);
                        resolve(undefined)
                    });
            });
    });
}

export const getLists = function(t, boardID) {
    return new Promise(function(resolve, reject) {
        getTrelloToken(t)
            .then(function(token) {
                sendRequest(buildTrelloRequest(token, `/boards/${boardID}/lists`))
                    .then(function(boards) {
                        resolve(boards);
                    })
                    .catch(function(err) {
                        console.log(err);
                        resolve(undefined)
                    });
            });
    });
}

export const postList = function(t, boardID, name) {
    return new Promise(function(resolve, reject) {
        getTrelloToken(t)
            .then(function(token) {
                sendRequest(buildTrelloRequest(token, `/boards/${boardID}/lists`, {
                    name: name,
                }), "POST")
                    .then(function(list) {
                        resolve(list);
                    })
                    .catch(function(err) {
                        console.log(err);
                        resolve(undefined)
                    });
            });
    });
}

export const moveCard = function(t, cardID, destinationBoardID, destinationListID) {
    return new Promise(function(resolve, reject) {
        getTrelloToken(t)
            .then(function(token) {
                sendRequest(buildTrelloRequest(token, `/cards/${cardID}`, {
                    idList: destinationListID,
                    idBoard: destinationBoardID,
                }), "PUT")
                    .then(function(card) {
                        resolve(card);
                    })
                    .catch(function(err) {
                        console.log(err);
                        resolve(undefined);
                    })
            });
    });
}

export const deleteCard = function(t, cardID) {
    return new Promise(function(resolve, reject) {
        getTrelloToken(t)
            .then(function(token) {
                sendRequest(buildTrelloRequest(token, `/cards/${cardID}`), "DELETE")
                    .then(function() {
                        resolve();
                    })
                    .catch(function(err) {
                        console.log(err);
                        resolve(undefined);
                    })
            });
    });
}

export const deleteAttachment = function(t, cardID, attachmentID) {
    return new Promise(function(resolve, reject) {
        getTrelloToken(t)
            .then(function(token) {
                sendRequest(buildTrelloRequest(token, `/cards/${cardID}/attachments/${attachmentID}`), "DELETE")
                    .then(function() {
                        resolve();
                    })
                    .catch(function(err) {
                        console.log(err);
                        resolve(undefined);
                    })
            });
    });
}

export const getAttachments = function(t, cardID) {
    return new Promise(function(resolve, reject) {
        getTrelloToken(t)
            .then(function(token) {
                sendRequest(buildTrelloRequest(token, `/cards/${cardID}/attachments`))
                    .then(function(attachments) {
                        resolve(attachments);
                    })
                    .catch(function(err) {
                        console.log(err);
                        resolve(undefined)
                    });
            });
    });
}

export const getLabels = function(t, boardID) {
    return new Promise(function(resolve, reject) {
        getTrelloToken(t)
            .then(function(token) {
                sendRequest(buildTrelloRequest(token, `/boards/${boardID}/labels`))
                    .then(function(labels) {
                        resolve(labels);
                    })
                    .catch(function(err) {
                        console.log(err);
                        resolve(undefined)
                    });
            });
    });
}
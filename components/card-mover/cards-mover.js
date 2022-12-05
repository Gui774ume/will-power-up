import { getTrelloToken } from "../../service/auth.js";
import { getLists, moveCard, postList } from "../../service/api.js";

let cardDestinationListName = function(card, now) {

    // check if the card is one month older (or more) than today's month
    let cardDate = card.due === null ? new Date(Date.parse(card.dateLastActivity)) : new Date(Date.parse(card.due));
    if (cardDate.getFullYear() >= now.getFullYear() && cardDate.getMonth() >= now.getMonth()) {
        return '';
    }

    // the card should be archived, generate the destination list name
    return `Archive-${cardDate.getMonth() + 1}/${cardDate.getFullYear()}`;
}

export const moveCardToArchives = async function(t, currentList) {
    let now = new Date();
    // check if the list needs to get cleaned up
    if (cardDestinationListName(currentList.cards[0], now) === "") {
        // nothing to do, move on
        return;
    }

    // check if the user is authorized
    await getTrelloToken(t)
        .then(async function (token) {
            if (token === undefined) {
                return;
            }

            // check if we currently are in the correct list
            await t.get('board', 'shared', 'archive_list')
                .then(async function(archiveList) {
                    if (archiveList === undefined) {
                        // nothing to do, the archive list isn't configured
                        return;
                    }

                    if (currentList.id !== archiveList.id) {
                        // leave now, we're not archiving this card yet
                        return;
                    }

                    // fetch the archive board
                    await t.get('board', 'shared', 'archive_board')
                        .then(async function(board) {
                            if (board === undefined) {
                                // nothing to do, archive board isn't configured
                                return;
                            }

                            let destinationBoardLists = [];
                            await getLists(t, board.id)
                                .then(async function (lists) {
                                    if (lists === null) {
                                        lists = [];
                                    }
                                    destinationBoardLists = lists;
                                });

                            for (const card of currentList.cards) {
                                // check if the card needs to be moved
                                let expectedDestinationListName = cardDestinationListName(card, now);
                                if (expectedDestinationListName === '') {
                                    // starting with this card, we no longer need to check if the cards should be moved
                                    break;
                                }

                                let listID = '';
                                destinationBoardLists.forEach(function (elem) {
                                    if (elem.name === expectedDestinationListName) {
                                        listID = elem.id;
                                    }
                                });

                                if (listID === '') {
                                    // create destination list
                                    await postList(t, board.id, expectedDestinationListName)
                                        .then(function (newList) {
                                            if (newList !== undefined) {
                                                listID = newList.id;
                                                destinationBoardLists.push(newList);
                                            }
                                        });
                                }

                                if (listID === '') {
                                    // try again later
                                    break;
                                }

                                // move the current card to the archives board
                                await moveCard(t, card.id, board.id, listID);
                            }
                        });
                });
        });
};
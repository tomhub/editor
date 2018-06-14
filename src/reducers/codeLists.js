import {
    UPD_ITEMCLDF,
    UPD_CODELIST,
    UPD_CODELISTSTD,
    ADD_CODELIST,
    DEL_CODELISTS,
    UPD_CODELISTSTDOIDS,
    UPD_CODEDVALUE,
    ADD_CODEDVALUE,
    DEL_CODEDVALUES,
    DEL_VARS,
} from "constants/action-types";
import { CodeList, CodeListItem, EnumeratedItem, Alias } from 'elements.js';
import getOid from 'utils/getOid.js';
import getCodedValuesAsArray from 'utils/getCodedValuesAsArray.js';
import deepEqual from 'fast-deep-equal';


const handleItemDefUpdate = (state, action) => {
    let newState = { ...state };
    // Delete source if the previous ItemDef had a codelist associated with it.
    let previousCodeListOid = action.prevObj.codeListOid;
    if (previousCodeListOid !== undefined) {
        let newSources = Object.assign({}, state[action.prevObj.codeListOid].sources);
        if (newSources.itemDefs.includes(action.oid)) {
            let newItemDefs = newSources.itemDefs.slice();
            newItemDefs.splice(newItemDefs.indexOf(action.oid),1);
            newSources.itemDefs = newItemDefs;
            newState = { ...newState, [previousCodeListOid]: new CodeList({ ...state[previousCodeListOid], sources: newSources }) };
        }
    }
    // Add source to the new ItemDef.
    let newCodeListOid = action.updateObj.codeListOid;
    if (newCodeListOid !== undefined) {
        let newSources = Object.assign({}, state[action.updateObj.codeListOid].sources);
        if (!newSources.itemDefs.includes(action.oid)) {
            newSources.itemDefs = newSources.itemDefs.slice();
            newSources.itemDefs.push(action.oid);
            newState = { ...newState, [newCodeListOid]: new CodeList({ ...state[newCodeListOid], sources: newSources }) };
        }
    }

    return newState;
};

const updateLinkedCodeList = (state, action) => {
    let newState = { ...state };
    // Newly linked codeList;
    let linkedCodeListOid = action.updateObj.linkedCodeListOid;
    let newCodeList = new CodeList({...state[action.oid], ...action.updateObj});

    // Previously linked codelist;
    let prevLinkedCodeListOid = state[action.oid].linkedCodeListOid;
    if (prevLinkedCodeListOid !== undefined) {
        // Remove link to that codelist from the previously linked codelist;
        newState = {
            ...newState,
            [prevLinkedCodeListOid]: new CodeList({...state[prevLinkedCodeListOid], linkedCodeListOid: undefined})
        };
    }

    if (linkedCodeListOid === undefined) {
        // If the linked codelist is removed;
        return {
            ...newState,
            [action.oid]: newCodeList,
        };
    } else {
        // If the codelist is added/replaced
        // Example status pre update:
        // VAR1 linked to VAR2, VAR3 linked to VAR4
        // User links VAR2 to VAR3
        // Result: VAR1 and VAR4 link to nothing, VAR2 links to VAR3;

        // OID of a codelist which is currently linked to the newly linked codelist;
        let linkedLinkedCodeListOid = state[linkedCodeListOid].linkedCodeListOid;
        if (linkedLinkedCodeListOid !== undefined) {
            // Remove link to the newly linked codelist from the previously linked codelist of the newly linked codelist;
            // The phrase above really makes sense
            newState = {
                ...newState,
                [linkedLinkedCodeListOid]: new CodeList({...state[linkedLinkedCodeListOid], linkedCodeListOid: undefined})
            };
        }
        // Add backward link to the linked codelist
        let newLinkedCodeList = new CodeList({...state[action.updateObj.linkedCodeListOid], linkedCodeListOid: action.oid});
        return {
            ...newState,
            [action.oid]        : newCodeList,
            [linkedCodeListOid] : newLinkedCodeList,
        };
    }
};

const updateCodeListType = (state, action) => {
    // Update the codelist type
    // Get the current type of a codelist
    let currentCodeList = state[action.oid];
    let newType = action.updateObj.codeListType;

    // If codelist was linked, unlink it
    let newState;
    if (currentCodeList.linkedCodeListOid !== undefined) {
        let newAction = { oid: action.oid, updateObj: { linkedCodeListOid: undefined } };
        newState = updateLinkedCodeList(state, newAction);
    } else {
        newState = state;
    }

    if (currentCodeList.externalCodeList !== undefined) {
        // If it is an external codelist, just remove the link
        let newCodeList = new CodeList({ ...newState[action.oid], ...action.updateObj, externalCodeList: undefined });
        return {...newState, [action.oid]: newCodeList};
    } else if (currentCodeList.enumeratedItems !== undefined && newType  === 'decoded') {
        // Transform EnumeratedItems to CodeListItems
        let codeListItems = {};
        Object.keys(currentCodeList.enumeratedItems).forEach( itemOid => {
            codeListItems[itemOid] = new CodeListItem({ ...currentCodeList.enumeratedItems[itemOid] });
        });
        let newCodeList = new CodeList({
            ...newState[action.oid],
            ...action.updateObj,
            enumeratedItems: undefined,
            codeListItems,
        });
        return {...newState, [action.oid]: newCodeList};

    } else if (currentCodeList.codeListItems !== undefined && newType  === 'enumerated') {
        // Transform CodeListItems to EnumeratedItems
        let enumeratedItems = {};
        Object.keys(currentCodeList.codeListItems).forEach( itemOid => {
            enumeratedItems[itemOid] =  new EnumeratedItem({ ...currentCodeList.codeListItems[itemOid] });
        });
        let newCodeList = new CodeList({
            ...newState[action.oid],
            ...action.updateObj,
            codeListItems: undefined,
            enumeratedItems,
        });
        return {...newState, [action.oid]: newCodeList};
    } else if (newType === 'external') {
        // Remove CodeListItems and EnumeratedItems
        let newCodeList = new CodeList({
            ...newState[action.oid],
            ...action.updateObj,
            codeListItems   : undefined,
            enumeratedItems : undefined,
        });
        return {...newState, [action.oid]: newCodeList};
    } else {
        // Nothing changed
        return state;
    }
};

const updateCodeListStandard = (state, action) => {
    // action.oid - codelist oid
    // action.updateObj - standardOid, alias, cdiscSubmissionValue, standardCodeList
    let codeList = state[action.oid];
    let alias;
    if (action.updateObj.alias !== undefined) {
        alias = new Alias({ ...action.updateObj.alias });
    }
    // Update coded values;
    let standardCodeList = action.updateObj.standardCodeList;
    let newCodeListItems;
    let newEnumeratedItems;
    if (standardCodeList !== undefined) {
        // TODO: When classes are removed, the below fork for decoded/enumerated should be removed as in this case code for
        // codeListItems and enumeratedItems will be the same
        let standardCodedValues = getCodedValuesAsArray(standardCodeList);
        if (codeList.codeListType === 'decoded') {
            newCodeListItems = {};
            Object.keys(codeList.codeListItems).forEach( itemOid => {
                if (standardCodedValues.includes(codeList.codeListItems[itemOid].codedValue)) {
                    // Add alias from the standard codelist if it is different
                    let standardItemOid = Object.keys(standardCodeList.codeListItems)[standardCodedValues.indexOf(codeList.codeListItems[itemOid].codedValue)];
                    if (!deepEqual(codeList.codeListItems[itemOid].alias, standardCodeList.codeListItems[standardItemOid].alias)){
                        newCodeListItems[itemOid] = new CodeListItem({
                            ...codeList.codeListItems[itemOid],
                            alias : new Alias({ ...standardCodeList.codeListItems[standardItemOid].alias }),
                        });
                    } else {
                        newCodeListItems[itemOid] = codeList.codeListItems[itemOid];
                    }
                } else {
                    // Check if the extendedValue attribute is set
                    if (codeList.codeListItems[itemOid].extendedValue === 'Y') {
                        newCodeListItems[itemOid] = codeList.codeListItems[itemOid];
                    } else {
                        newCodeListItems[itemOid] = new CodeListItem({
                            ...codeList.codeListItems[itemOid],
                            alias         : undefined,
                            extendedValue : 'Y',
                        });
                    }
                    newCodeListItems[itemOid] = codeList.codeListItems[itemOid];
                }
            });
        } else if (codeList.codeListType === 'enumerated') {
            newEnumeratedItems = {};
            Object.keys(codeList.enumeratedItems).forEach( itemOid => {
                if (standardCodedValues.includes(codeList.enumeratedItems[itemOid].codedValue)) {
                    // Add alias from the standard codelist if it is different
                    let standardItemOid = Object.keys(standardCodeList.codeListItems)[standardCodedValues.indexOf(codeList.enumeratedItems[itemOid].codedValue)];
                    if (!deepEqual(codeList.enumeratedItems[itemOid].alias, standardCodeList.codeListItems[standardItemOid].alias)){
                        newEnumeratedItems[itemOid] = new EnumeratedItem({
                            ...codeList.enumeratedItems[itemOid],
                            alias : new Alias({ ...standardCodeList.codeListItems[standardItemOid].alias }),
                        });
                    } else {
                        newEnumeratedItems[itemOid] = codeList.enumeratedItems[itemOid];
                    }
                } else {
                    // Check if the extendedValue attribute is set
                    if (codeList.enumeratedItems[itemOid].extendedValue === 'Y') {
                        newEnumeratedItems[itemOid] = codeList.enumeratedItems[itemOid];
                    } else {
                        newEnumeratedItems[itemOid] = new EnumeratedItem({
                            ...codeList.enumeratedItems[itemOid],
                            alias         : undefined,
                            extendedValue : 'Y',
                        });
                    }
                }
            });
        }
    } else {
        // If the standard was removed, remove all alias/extendedValue elements
        // TODO: When classes are removed, the below fork for decoded/enumerated should be removed as in this case code for
        // codeListItems and enumeratedItems will be the same
        if (codeList.codeListType === 'decoded') {
            newCodeListItems = {};
            Object.keys(codeList.codeListItems).forEach( itemOid => {
                if (codeList.codeListItems[itemOid].alias !== undefined || codeList.codeListItems[itemOid].extendedValue !== undefined) {
                    newCodeListItems[itemOid] = new CodeListItem({
                        ...codeList.codeListItems[itemOid],
                        alias         : undefined,
                        extendedValue : undefined,
                    });
                } else {
                    newCodeListItems[itemOid] = codeList.codeListItems[itemOid];
                }
            });
        } else if (codeList.codeListType === 'enumerated') {
            newEnumeratedItems = {};
            Object.keys(codeList.enumeratedItems).forEach( itemOid => {
                if (codeList.enumeratedItems[itemOid].alias !== undefined || codeList.enumeratedItems[itemOid].extendedValue !== undefined) {
                    newEnumeratedItems[itemOid] = new EnumeratedItem({
                        ...codeList.enumeratedItems[itemOid],
                        alias         : undefined,
                        extendedValue : undefined,
                    });
                } else {
                    newEnumeratedItems[itemOid] = codeList.enumeratedItems[itemOid];
                }
            });
        }
    }

    let newCodeList = new CodeList({
        ...state[action.oid],
        standardOid          : action.updateObj.standardOid,
        cdiscSubmissionValue : action.updateObj.cdiscSubmissionValue,
        alias                : alias,
        codeListItems        : newCodeListItems,
        enumeratedItems      : newEnumeratedItems,
    });

    return {...state, [action.oid]: newCodeList};
};

const updateCodeList = (state, action) => {
    // action.oid - codelist oid
    // action.updateObj - object with CodeList class properties
    let newCodeList = new CodeList({...state[action.oid], ...action.updateObj});

    // Linked codelist updated
    if (action.updateObj.hasOwnProperty('linkedCodeListOid')) {
        return updateLinkedCodeList(state, action);
    } else if (action.updateObj.hasOwnProperty('codeListType')) {
        return updateCodeListType(state, action);
    } else {
        return {...state, [action.oid]: newCodeList};
    }
};

const addCodeList = (state, action) => {
    // action.updateObj - codelist attributes
    let codeListOids = Object.keys(state);
    let codeListOid = getOid('CodeList', undefined, codeListOids);
    let codeList = new CodeList({
        oid: codeListOid,
        ...action.updateObj,
    });
    return {...state, [codeListOid]: codeList};
};

const deleteCodeLists = (state, action) => {
    // action.deleteObj.codeListOids - list of codeLists to remove
    let newState = { ...state };
    action.deleteObj.codeListOids.forEach( codeListOid => {
        // If those codelists have a linked codelist, remove reference to it from the linked codelist
        let linkedCodeListOid = state[codeListOid].linkedCodeListOid;
        if (linkedCodeListOid !== undefined) {
            let newLinkedCodeList = new CodeList({
                ...state[linkedCodeListOid], linkedCodeListOid: undefined
            });
            newState = { ...newState, [linkedCodeListOid]: newLinkedCodeList };
        }
        delete newState[codeListOid];
    });

    return newState;
};

const updateCodeListStandardOids = (state, action) => {
    // action.updateObj - object with a list of codeLists each corresponding to an object {standardOid, cdiscSubmissionValue}
    let newState = { ...state };
    Object.keys(action.updateObj).forEach( codeListOid => {
        let newCodeList = new CodeList({
            ...state[codeListOid],
            standardOid          : action.updateObj[codeListOid].standardOid,
            cdiscSubmissionValue : action.updateObj[codeListOid].cdiscSubmissionValue,
        });
        newState = { ...newState, [codeListOid]: newCodeList };
    });
    return newState;
};

const updateCodedValue = (state, action) => {
    // action.updateObj - object with properties to update
    let codeList = state[action.source.codeListOid];
    let newCodeList;
    if (codeList.codeListType === 'decoded') {
        let newCodeListItems = {
            ...codeList.codeListItems,
            [action.source.oid]: new CodeListItem({ ...codeList.codeListItems[action.source.oid], ...action.updateObj }),
        };
        newCodeList = new CodeList({ ...state[action.source.codeListOid], codeListItems: newCodeListItems });
    } else if (codeList.codeListType === 'enumerated') {
        let newEnumeratedItems = {
            ...codeList.enumeratedItems,
            [action.source.oid]: new EnumeratedItem({ ...codeList.enumeratedItems[action.source.oid], ...action.updateObj }),
        };
        newCodeList = new CodeList({ ...state[action.source.codeListOid], enumeratedItems: newEnumeratedItems });

    } else if (codeList.codeListType === 'external') {
        newCodeList = new CodeList({ ...state[action.source.codeListOid], externalCodeList: {...action.updateObj} });
    }
    return { ...state, [action.source.codeListOid]: newCodeList };
};

const addCodedValue = (state, action) => {
    // action.codedValue - new value
    // action.codeListOid - OID of the codelist
    let codeList = state[action.codeListOid];
    let newCodeList;
    if (codeList.codeListType === 'decoded') {
        let newOid = getOid('CodeListItem', undefined, Object.keys(codeList.codeListItems));
        let newCodeListItems = {
            ...codeList.codeListItems,
            [newOid]: new CodeListItem({ codedValue: action.codedValue }),
        };
        let newItemOrder = codeList.itemOrder.slice();
        newItemOrder.push(newOid);
        newCodeList = new CodeList({ ...state[action.codeListOid], codeListItems: newCodeListItems, itemOrder: newItemOrder });
    } else if (codeList.codeListType === 'enumerated') {
        let newOid = getOid('CodeListItem', undefined, Object.keys(codeList.enumeratedItems));
        let newEnumeratedItems = {
            ...codeList.enumeratedItems,
            [newOid]: new EnumeratedItem({ codedValue: action.codedValue }),
        };
        let newItemOrder = codeList.itemOrder.slice();
        newItemOrder.push(newOid);
        newCodeList = new CodeList({ ...state[action.codeListOid], enumeratedItems: newEnumeratedItems, itemOrder: newItemOrder });

    } else if (codeList.codeListType === 'external') {
        // No coded values for the external codelists
        return state;
    }
    return { ...state, [action.codeListOid]: newCodeList };
};

const deleteCodedValues = (state, action) => {
    // action.codeListOid - OID of the codelist
    // action.deletedOids - list of OIDs which are removed
    let codeList = state[action.codeListOid];
    let newCodeList;
    if (codeList.codeListType === 'decoded') {
        let newCodeListItems = { ...codeList.codeListItems };
        let newItemOrder = codeList.itemOrder.slice();
        action.deletedOids.forEach( deletedOid => {
            delete newCodeListItems.deletedOid;
            newItemOrder.splice(newItemOrder.indexOf(deletedOid),1);
        });
        newCodeList = new CodeList({ ...state[action.codeListOid], codeListItems: newCodeListItems, itemOrder: newItemOrder });
    } else if (codeList.codeListType === 'enumerated') {
        let newEnumeratedItems = { ...codeList.enumeratedItems };
        let newItemOrder = codeList.itemOrder.slice();
        action.deletedOids.forEach( deletedOid => {
            delete newEnumeratedItems.deletedOid;
            newItemOrder.splice(newItemOrder.indexOf(deletedOid),1);
        });
        newCodeList = new CodeList({ ...state[action.codeListOid], enumeratedItems: newEnumeratedItems, itemOrder: newItemOrder });

    } else if (codeList.codeListType === 'external') {
        // No coded values for the external codelists
        return state;
    }
    return { ...state, [action.codeListOid]: newCodeList };
};

const deleteCodeListReferences = (state, action, type) => {
    // action.deleteObj.codeListOids contains:
    // {codeListOid1: [itemOid1, itemOid2], codeListOid2: [itemOid3, itemOid1]}
    let newState = { ...state };
    Object.keys(action.deleteObj.codeListOids).forEach( codeListOid => {
        action.deleteObj.codeListOids[codeListOid].forEach(itemOid => {
            let codeList = newState[codeListOid];
            let sourceNum = [].concat.apply([],Object.keys(codeList.sources).map(type => (codeList.sources[type]))).length;
            if (sourceNum <= 1 && codeList.sources.itemDefs[0] === itemOid) {
                // If the item to which codeList is attached is the only one, keep it
                // As codelists can be  created and worked on without any variables
                // delete newState[codeList.oid];
            } else if (codeList.sources.itemDefs.includes(itemOid)){
                // Remove  referece to the source OID from the list of codeList sources
                let newSources = codeList.sources.itemDefs.slice();
                newSources.splice(newSources.indexOf(itemOid),1);
                let newCodeList = new CodeList({ ...codeList, sources: { ...codeList.sources, itemDefs: newSources } });
                newState = {...newState, [codeList.oid]: newCodeList};
            }
        });
    });
    return newState;
};


const codeLists = (state = {}, action) => {
    switch (action.type) {
        case ADD_CODELIST:
            return addCodeList(state, action);
        case DEL_CODELISTS:
            return deleteCodeLists(state, action);
        case UPD_CODELIST:
            return updateCodeList(state, action);
        case UPD_CODELISTSTD:
            return updateCodeListStandard(state, action);
        case UPD_ITEMCLDF:
            return handleItemDefUpdate(state, action);
        case UPD_CODELISTSTDOIDS:
            return updateCodeListStandardOids(state, action);
        case UPD_CODEDVALUE:
            return updateCodedValue(state, action);
        case ADD_CODEDVALUE:
            return addCodedValue(state, action);
        case DEL_CODEDVALUES:
            return deleteCodedValues(state, action);
        case DEL_VARS:
            return deleteCodeListReferences(state, action);
        default:
            return state;
    }
};

export default codeLists;

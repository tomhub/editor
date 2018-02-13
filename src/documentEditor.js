import IconButton from 'material-ui/IconButton';
import PropTypes from 'prop-types';
import ItemSelect from './itemSelect.js';
import PdfPageEditor from './pdfPageEditor.js';
import Divider from 'material-ui/Divider';
import DeleteIcon from 'material-ui-icons/Delete';
import PictureAsPdf from 'material-ui-icons/PictureAsPdf';
import Grid from 'material-ui/Grid';
import React from 'react';
import { withStyles } from 'material-ui/styles';
import Tooltip from 'material-ui/Tooltip';

const styles = theme => ({
    button: {
        margin: 'none',
    },
    iconButton: {
        marginBottom: '8px',
    },
});

class DocumentEditor extends React.Component {
    handleChange = (name, documentId, pdfPageRefId) => event => {
        let newObject =this.props.parentObj.clone();
        if (name === 'updateDocument') {
            let newDocuments = newObject.documents.slice();
            newDocuments[documentId].leaf = this.props.leafs[event.target.value];
            newObject.documents = newDocuments;
        }
        if (name === 'deleteDocument') {
            let newDocuments = newObject.documents.slice();
            newDocuments.splice(documentId,1);
            newObject.documents = newDocuments;
        }
        if (name === 'newDocument') {
            newObject.addDocument();
        }
        if (name === 'newPdfPageRef') {
            let addedIndex = newObject.documents[documentId].addPdfPageRef();
            // Default to PhysicalRef
            newObject.documents[documentId].pdfPageRefs[addedIndex].type = 'PhysicalRef';

        }
        if (name === 'deletePdfPageRef') {
            let newPdfPageRefs = newObject.documents[documentId].pdfPageRefs.slice();
            newPdfPageRefs.splice(pdfPageRefId,1);
            newObject.documents[documentId].pdfPageRefs = newPdfPageRefs;
        }
        if (name === 'updatePdfPageRef') {
            let newPdfPageRefs = newObject.documents[documentId].pdfPageRefs.slice();
            newPdfPageRefs[pdfPageRefId] = event;
            newObject.documents[documentId].pdfPageRefs = newPdfPageRefs;
        }
        this.props.handleChange(newObject);
    };

    getPdfPage = (document, documentId, classes) => {
        let result = [];
        result = result.concat(document.pdfPageRefs.map( (pdfPageRef, index) => {
            return (
                <PdfPageEditor
                    key={index}
                    value={pdfPageRef}
                    pdfPageRefId={index}
                    documentId={documentId}
                    handleChange={this.handleChange}
                />);
        }));

        return result;
    }

    getDocuments = (documents, documentList, classes) => {
        return documents.map( (document, index) => {
            return (
                <Grid container justify='flex-start' alignItems='flex-end' spacing={8} key={index}>
                    <Grid item>
                        <Tooltip title="Remove Document" placement="right">
                            <IconButton
                                color='default'
                                onClick={this.handleChange('deleteDocument',index)}
                                className={classes.button}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </Tooltip>
                    </Grid>
                    <Grid item>
                        <ItemSelect
                            options={documentList}
                            value={document.leaf.id || Object.keys(documentList)[0]}
                            handleChange={this.handleChange('updateDocument',index)}
                            label='Document'
                        />
                    </Grid>
                    <Grid item>
                        <Tooltip title="Add PDF Page Referece" placement="right">
                            <IconButton
                                disabled={!document.leaf.isPdf}
                                color='primary'
                                onClick={this.handleChange('newPdfPageRef',index)}
                                className={classes.button}
                            >
                                <PictureAsPdf/>
                            </IconButton>
                        </Tooltip>
                    </Grid>
                    { document.leaf.isPdf &&
                        <Grid item xs={12}>
                            {this.getPdfPage(document, index, classes)}
                        </Grid>
                    }
                </Grid>
            );
        });
    }

    render () {
        // Get the list of available documents
        const leafs = this.props.leafs;
        let documentList = [];
        Object.keys(leafs).forEach( (leafId) => {
            documentList.push({[leafId]: leafs[leafId].title});
        });

        const { classes } = this.props;
        const numberOfDocs = this.props.parentObj.documents.length;

        return (
            <Grid xs={12} item>
                {numberOfDocs > 0 && <Divider/>}
                {this.getDocuments(this.props.parentObj.documents, documentList, classes)}
                {numberOfDocs > 0 && <Divider/>}
            </Grid>
        );
    }
}

DocumentEditor.propTypes = {
    parentObj       : PropTypes.object.isRequired,
    leafs           : PropTypes.object.isRequired,
    annotatedCrf    : PropTypes.array.isRequired,
    supplementalDoc : PropTypes.array.isRequired,
};

export default withStyles(styles)(DocumentEditor);

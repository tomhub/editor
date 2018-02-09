import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from 'material-ui/styles';
import ItemSelect from './itemSelect.js';
import DeleteIcon from 'material-ui-icons/Delete';
import Grid from 'material-ui/Grid';
import Button from 'material-ui/Button';
import { FormControlLabel, FormControl } from 'material-ui/Form';
import Switch from 'material-ui/Switch';
import TextField from 'material-ui/TextField';
import {PdfPageRef} from './elements.js';

const pageRefTypes = [{'PhysicalRef': 'Physical Reference'},{'NamedDestination': 'Named Destination'}];

const styles = theme => ({
    container: {
        display  : 'flex',
        flexWrap : 'wrap',
    },
    formControl: {
        margin: 'none',
    },
    formControlRange: {
        marginRight : theme.spacing.unit,
        marginLeft  : theme.spacing.unit
    },
    select: {
        marginTop: theme.spacing.unit * 2,
    },
    textFieldRange: {
        width: '80px'
    },
});

class PdfPage extends React.Component {
    constructor (props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
        this.state = {
            pageRangeFlag: ((this.props.value.firstPage !== undefined || this.props.value.lastPage !== undefined)? true : false)
        };
    }

    handleChange = name => event => {
        // Create the new pdfPageRef
        let newPdfPageRef = new PdfPageRef({
            pageRefs  : this.props.value.pageRefs,
            firstPage : this.props.value.firstPage,
            lastPage  : this.props.value.lastPage,
            type      : this.props.value.type,
            title     : this.props.value.title,
        });
        // If pdfRefs are update -> remove first and last and vice versa
        if (name === 'pageRefs' && (newPdfPageRef.firstPage !== undefined || newPdfPageRef.lastPage !== undefined)) {
            newPdfPageRef.firstPage = undefined;
            newPdfPageRef.lastPage = undefined;
        }
        if ((name === 'firstPage' || name === 'lastPage') && (newPdfPageRef.pageRefs !== undefined)) {
            newPdfPageRef.pageRefs = undefined;
        }
        // If type is changed, remove all page refs
        if (name === 'type' && (this.props.value.type !== event.target.value)) {
            newPdfPageRef.pageRefs = undefined;
            newPdfPageRef.firstPage = undefined;
            newPdfPageRef.lastPage = undefined;
        }
        // Overwrite the updated property
        newPdfPageRef[name] = event.target.value;
        // Life the state up
        this.props.handleChange('updatePdfPageRef', this.props.documentId, this.props.pdfPageRefId)(newPdfPageRef);
    }

    getPageInputs = (type,classes) => {
        let result = [];
        if (type === 'PhysicalRef') {
            result.push(
                <Grid item key='switch'>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={this.state.pageRangeFlag}
                                onChange={(event, checked) => this.setState({ pageRangeFlag: checked })}
                            />
                        }
                        label="Range"
                    />
                </Grid>
            );
            if (!this.state.pageRangeFlag) {
                result.push(
                    <Grid item key='pages'>
                        <FormControl className={classes.formControl}>
                            <TextField
                                label="Pages (space separated)"
                                className={classes.textField}
                                value={this.props.value.pageRefs}
                                onChange={this.handleChange('pageRefs')}
                            />
                        </FormControl>
                    </Grid>
                );
            } else {
                result.push(
                    <Grid item key='firstLast'>
                        <FormControl key='first' className={classes.formControlRange}>
                            <TextField
                                label="First Page"
                                className={classes.textFieldRange}
                                value={this.props.value.firstPage}
                                onChange={this.handleChange('firstPage')}
                            />
                        </FormControl>
                        <FormControl key='last' className={classes.formControlRange}>
                            <TextField
                                label="Last Page"
                                className={classes.textFieldRange}
                                value={this.props.value.lastPage}
                                onChange={this.handleChange('lastPage')}
                            />
                        </FormControl>
                    </Grid>
                );
            }
        } else if (type === 'NamedDestination') {
            result.push(
                <Grid item key='NamedDestination'>
                    <FormControl className={classes.formControl}>
                        <TextField
                            label="Destination Anchor"
                            className={classes.textField}
                            value={this.props.value.pageRefs}
                            onChange={this.handleChange('pageRefs')}
                        />
                    </FormControl>
                </Grid>
            );
        }
        // Title is added in 2.1 only
        if (this.props.defineVersion === '2.1') {
            result.push(
                <Grid item key='Title'>
                    <FormControl className={classes.formControl}>
                        <TextField
                            label="Title"
                            className={classes.textField}
                            value={this.props.value.title}
                            onChange={this.handleChange('title')}
                        />
                    </FormControl>
                </Grid>
            );

        }
        return result;
    }

    render() {
        const { classes } = this.props;

        return (
            <Grid container>
                <Grid item>
                    <Button
                        mini
                        color='default'
                        onClick={this.props.handleChange('deletePdfPageRef',this.props.documentId,this.props.pdfPageRefId)}
                        variant='fab'
                        style={{margin: '5pt'}}
                    >
                        <DeleteIcon />
                    </Button>
                </Grid>
                <Grid item>
                    <ItemSelect
                        options={pageRefTypes}
                        value={this.props.value.type}
                        handleChange={this.handleChange('type')}
                        label='Reference Type'
                    />
                </Grid>
                {this.getPageInputs(this.props.value.type, classes)}
            </Grid>
        );
    }
}

PdfPageRef.propTypes = {
    classes : PropTypes.object.isRequired,
    value   : PropTypes.object.isRequired,
};

export default withStyles(styles)(PdfPage);


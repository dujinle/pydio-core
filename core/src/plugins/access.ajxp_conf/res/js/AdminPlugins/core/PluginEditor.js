import React from 'react'
import {RaisedButton, FlatButton} from 'material-ui'

/**
 * Editor for a given plugin. By default, displays documentation in a left column panel,
 * and plugin parameters as form cards on the right.
 * May take additionalPanes to be appended to the form cards.
 */
const PluginEditor = React.createClass({

    mixins:[AdminComponents.MessagesConsumerMixin],

    propTypes:{
        rootNode:React.PropTypes.instanceOf(AjxpNode).isRequired,
        close:React.PropTypes.func,
        style:React.PropTypes.string,
        className:React.PropTypes.string,
        additionalPanes:React.PropTypes.shape({
            top:React.PropTypes.array,
            bottom:React.PropTypes.array
        }),
        docAsAdditionalPane:React.PropTypes.bool,
        additionalDescription:React.PropTypes.string,
        registerCloseCallback:React.PropTypes.func,
        onBeforeSave:React.PropTypes.func,
        onAfterSave:React.PropTypes.func,
        onRevert:React.PropTypes.func,
        onDirtyChange:React.PropTypes.func
    },


    loadPluginData:function(plugId){

        PydioApi.getClient().request({
            get_action:'get_plugin_manifest',
            plugin_id:plugId
        }, function(transport){

            var xmlData = transport.responseXML;
            var params = PydioForm.Manager.parseParameters(xmlData, "//global_param");
            var xmlValues = XMLUtils.XPathSelectNodes(xmlData, "//plugin_settings_values/param");
            var documentation = XMLUtils.XPathSelectSingleNode(xmlData, "//plugin_doc");
            var enabledAlways = false;
            var rootNode = XMLUtils.XPathSelectSingleNode(xmlData, "admin_data");
            var label = rootNode.firstChild.attributes.getNamedItem("label").value;
            var description = rootNode.firstChild.attributes.getNamedItem("description").value;
            try{enabledAlways = rootNode.firstChild.attributes.getNamedItem("enabled").value === 'always';}catch (e){}

            var paramsValues = {};
            xmlValues.forEach(function(child){
                if(child.nodeName != 'param') return;
                var valueParamName = child.getAttribute("name");
                if(child.getAttribute("cdatavalue")){
                    paramsValues[valueParamName] = child.firstChild.nodeValue;
                }else{
                    paramsValues[valueParamName] = child.getAttribute('value');
                }
                var cType = null;
                params.map(function(def){
                    if(def.name == valueParamName) cType = def.type;
                });
                if(cType == 'boolean') paramsValues[valueParamName] = (paramsValues[valueParamName] == "true");
                else if(cType == 'integer') paramsValues[valueParamName] = parseInt(paramsValues[valueParamName]);
            });

            this.setState({
                loaded: true,
                parameters:params,
                values:paramsValues,
                originalValues:LangUtils.deepCopy(paramsValues),
                documentation:documentation,
                enabledAlways:enabledAlways,
                dirty:false,
                label:label,
                description:description,
                pluginId:plugId
            });

            if(this.props.registerCloseCallback){
                this.props.registerCloseCallback(function(){
                    if(this.state && this.state.dirty && !confirm(this.context.getMessage('19','role_editor'))){
                        return false;
                    }
                }.bind(this));
            }

        }.bind(this));

    },

    componentWillReceiveProps:function(nextProps){
        if(nextProps.rootNode.getPath()!= this.props.rootNode.getPath()){
            this.loadPluginData(PathUtils.getBasename(nextProps.rootNode.getPath()));
            this.setState({values:{}});
        }
    },

    getInitialState:function(){

        var plugId = PathUtils.getBasename(this.props.rootNode.getPath());
        this.loadPluginData(plugId);

        return {
            loaded:false,
            parameters:[],
            values:{},
            documentation:'',
            dirty:false,
            label:'',
            docOpen:false
        };
    },

    externalSetDirty:function(){
        this.setState({dirty:true});
    },

    onChange:function(formValues, dirty){
        this.setState({dirty:dirty, values:formValues});
        if(this.props.onDirtyChange){
            this.props.onDirtyChange(dirty, formValues);
        }
    },

    save:function(){
        var clientParams = {
            get_action:"edit",
            sub_action:"edit_plugin_options",
            plugin_id:this.state.pluginId
        };
        var postParams = this.refs['formPanel'].getValuesForPOST(this.state.values);
        if(postParams['DRIVER_OPTION_AJXP_PLUGIN_ENABLED']){
            postParams['DRIVER_OPTION_AJXP_PLUGIN_ENABLED_ajxptype'] = "boolean";
        }
        clientParams = LangUtils.mergeObjectsRecursive(clientParams, postParams);
        if(this.props.onBeforeSave){
            this.props.onBeforeSave(clientParams);
        }
        PydioApi.getClient().request(clientParams, function(transport){
            this.setState({dirty:false});
            if(this.props.onAfterSave){
                this.props.onAfterSave(transport);
            }
        }.bind(this));
    },

    revert:function(){
        this.setState({dirty:false, values:this.state.originalValues});
        if(this.props.onRevert){
            this.props.onRevert(this.state.originalValues);
        }
    },

    parameterHasHelper:function(paramName, testPluginId){
        paramName = paramName.split('/').pop();
        var h = PydioForm.Manager.hasHelper(PathUtils.getBasename(this.props.rootNode.getPath()), paramName);
        if(!h && testPluginId){
            h = PydioForm.Manager.hasHelper(testPluginId, paramName);
        }
        return h;
    },

    showHelper:function(helperData, testPluginId){
        if(helperData){
            var plugId = PathUtils.getBasename(this.props.rootNode.getPath());
            if(testPluginId && !PydioForm.Manager.hasHelper(plugId, helperData['name'])){
                helperData['pluginId'] = testPluginId;
            }else{
                helperData['pluginId'] = plugId;
            }
            helperData['updateCallback'] = this.helperUpdateValues.bind(this);
        }
        this.setState({helperData:helperData});
    },

    closeHelper:function(){
        this.setState({helperData:null});
    },

    /**
     * External helper can pass a full set of values and update them
     * @param newValues
     */
    helperUpdateValues:function(newValues){
        this.onChange(newValues, true);
    },

    toggleDocPane: function(){
        this.setState({docOpen:!this.state.docOpen});
    },

    monitorMainPaneScrolling:function(event){
        if(event.target.className.indexOf('pydio-form-panel') === -1){
            return;
        }
        var scroll = event.target.scrollTop;
        var newState = (scroll > 5);
        var currentScrolledState = (this.state && this.state.mainPaneScrolled);
        if(newState != currentScrolledState){
            this.setState({mainPaneScrolled:newState});
        }
    },

    render: function(){

        var addPanes = {top:[], bottom:[]};
        if(this.props.additionalPanes){
            addPanes.top = this.props.additionalPanes.top.slice();
            addPanes.bottom = this.props.additionalPanes.bottom.slice();
        }
        var closeButton;
        if(this.props.closeEditor){
            closeButton = <RaisedButton label={this.context.getMessage('86','')} onTouchTap={this.props.closeEditor}/>
        }

        var doc = this.state.documentation;
        if(doc && this.props.docAsAdditionalPane){
            doc = doc.firstChild.nodeValue.replace('<p><ul', '<ul').replace('</ul></p>', '</ul>').replace('<p></p>', '');
            doc = doc.replace('<img src="', '<img style="width:90%;" src="plugins/' + this.state.pluginId + '/');
            var readDoc = function(){
                return {__html:doc};
            };
            var docPane = (
                <div className={"plugin-doc" + (this.state.docOpen?' plugin-doc-open':'')}>
                    <h3>Documentation</h3>
                    <div className="plugin-doc-pane" dangerouslySetInnerHTML={readDoc()}></div>
                </div>
            );
            addPanes.top.push(docPane);
        }

        var scrollingClassName = '';
        if(this.state && this.state.mainPaneScrolled){
            scrollingClassName = ' main-pane-scrolled';
        }
        // Building  a form
        return (
            <div className={(this.props.className?this.props.className+" ":"") + "main-layout-nav-to-stack vertical-layout plugin-board" + scrollingClassName} style={this.props.style}>
                <ReactMUI.Paper className="left-nav" zDepth={0}>
                    <h1 className="admin-panel-title">{this.state.label}</h1>
                    <div className="buttons-cont" style={{padding:16}}>
                        <FlatButton secondary={true} disabled={!this.state.dirty} label={this.context.getMessage('plugins.6')} onTouchTap={this.revert}/>
                        &nbsp;&nbsp;
                        <FlatButton secondary={true} disabled={!this.state.dirty} label={this.context.getMessage('plugins.5')} onTouchTap={this.save}/>
                        &nbsp;&nbsp;&nbsp;
                        {closeButton}
                    </div>
                    <div className={"plugin-doc-pane"}>{this.state.description} {this.props.additionalDescription}</div>
                </ReactMUI.Paper>
                <PydioForm.FormPanel
                    ref="formPanel"
                    className="row-flex"
                    parameters={this.state.parameters}
                    values={this.state.values}
                    onChange={this.onChange}
                    disabled={false}
                    additionalPanes={addPanes}
                    tabs={this.props.tabs}
                    setHelperData={this.showHelper}
                    checkHasHelper={this.parameterHasHelper}
                    onScrollCallback={this.monitorMainPaneScrolling}
                />
                <PydioForm.PydioHelper
                    helperData={this.state?this.state.helperData:null}
                    close={this.closeHelper}
                />
            </div>
        );


    }
});

export {PluginEditor as default}
const React = require('react')
const {TextField, FlatButton, CardTitle, Divider} = require('material-ui')
import UsersList from './UsersList'
import Loaders from './Loaders'
import ActionsPanel from '../avatar/ActionsPanel'
const {PydioContextConsumer} = require('pydio').requireLib('boot')

/**
 * Display info about a Team inside a popover-able card
 */
class TeamCard extends React.Component{

    constructor(props, context){
        super(props, context);
        this.state = {label: this.props.item.label};
    }

    /**
     * Use loader to get team participants
     * @param item
     */
    loadMembers(item){
        this.setState({loading: true});
        Loaders.childrenAsPromise(item, false).then((children) => {
            Loaders.childrenAsPromise(item, true).then((children) => {
                this.setState({members:item.leafs, loading: false});
            });
        });
    }
    componentWillMount(){
        this.loadMembers(this.props.item);
    }
    componentWillReceiveProps(nextProps){
        this.loadMembers(nextProps.item);
        this.setState({label: nextProps.item.label});
    }
    onLabelChange(e, value){
        this.setState({label: value});
    }
    updateLabel(){
        if(this.state.label !== this.props.item.label){
            PydioUsers.Client.updateTeamLabel(this.props.item.id.replace('/AJXP_TEAM/', ''), this.state.label, () => {
                this.props.onUpdateAction(this.props.item);
            });
        }
        this.setState({editMode: false});
    }
    render(){
        const {item, onDeleteAction, onCreateAction, getMessage} = this.props;

        const editProps = {
            team: item,
            userEditable: true,
            onDeleteAction: () => {this.props.onDeleteAction(item._parent, [item])},
            onEditAction: () => {this.setState({editMode: !this.state.editMode})},
            reloadAction: () => {this.props.onUpdateAction(item)}
        };

        let title;
        if(this.state.editMode){
            title = (
                <div style={{display:'flex', alignItems:'center', margin: 16}}>
                    <TextField style={{flex: 1, fontSize: 24}} fullWidth={true} disabled={false} underlineShow={false} value={this.state.label} onChange={this.onLabelChange.bind(this)}/>
                    <FlatButton secondary={true} label={getMessage(48)} onTouchTap={() => {this.updateLabel()}}/>
                </div>
            );
        }else{
            title = <CardTitle title={this.state.label} subtitle={(item.leafs && item.leafs.length ? getMessage(576).replace('%s', item.leafs.length) : getMessage(577))}/>;
        }
        return (
            <div>
                {title}
                <ActionsPanel {...this.props} {...editProps} />
                <Divider/>
                <UsersList subHeader={getMessage(575)} onItemClicked={()=>{}} item={item} mode="inner" onDeleteAction={onDeleteAction}/>
            </div>
        )
    }

}

TeamCard.propTypes = {
    /**
     * Pydio instance
     */
    pydio: React.PropTypes.instanceOf(Pydio),
    /**
     * Team data object
     */
    item: React.PropTypes.object,
    /**
     * Applied to root container
     */
    style: React.PropTypes.object,
    /**
     * Called to dismiss the popover
     */
    onRequestClose: React.PropTypes.func,
    /**
     * Delete current team
     */
    onDeleteAction: React.PropTypes.func,
    /**
     * Update current team
     */
    onUpdateAction: React.PropTypes.func
};

TeamCard = PydioContextConsumer(TeamCard);

export {TeamCard as default}
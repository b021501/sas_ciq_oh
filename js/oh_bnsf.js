/**
*
*	Author:   Matthew Perry (matthew.perry@sas.com)
*	Company:  SAS Institute
*	Dev Date: 2/16/2021
*	Desc:     This JavaScript handles the iteraction between the Loco OH forms and the Viya backend. 
*			  All data is stored in promoted CAS tables
*
**/

var currentSession;

var viya_server = window.location.origin;
//var viya_server = 'https://viya.sasviya.bnsf.com';

var oh_lib = 'LOCO_OH';

var oh_baseline_data = 'OH_SCENARIO_BASELINE';
var oh_scenario_data = 'OH_SCENARIO';
var oh_model_out_data = 'ABT_NEXTOHSCHEDULE';

var scenario_user;
var oh_baseline_list = [];

/**
*
*	Initialize the connection to the Viya backend. Leverages the authentication from the browser.
*	Loads baseline data and saved scenarios
*
**/
function initOH(){

	appInit().then ( session => {
		currentSession = session;
		loadBaselineData();
		loadSavedScenarios();
	}).catch( err => handleError(err));

}

/**
*
*	Sets up all the Viya connections once so we don't have to repeat this
*	Results are current user identified and a sesson for that user
*
**/
async function appInit(){

	let p = {
	  authType: 'server',
	  host: viya_server
	}
    let msg = await store.logon(p);
    let {casManagement} = await store.addServices ('casManagement');
    let servers = await store.apiCall(casManagement.links('servers'));
    let serverName = servers.itemsList(0);
    let session = await store.apiCall(servers.itemsCmd(serverName, 'createSession'));
	
	let { identities } = await store.addServices('identities');
    let c = await store.apiCall(identities.links('currentUser'));
	scenario_user = c.items('id');
	
    return session;
}

/**
*
*	Load the baseline dataset
*
**/
function loadBaselineData(){

	params_query={'query': 'select * from ' + oh_lib + '.' + oh_baseline_data + ' order by oh_cost_per_loco desc'};
	let payload = {
		action: 'fedSql.execDirect',
		data  : params_query
	}

	store.runAction(currentSession, payload).then ( r => {
		var results = r.items('results', 'Result Set').toJS().rows;
		for(var i=0; i < results.length; i++) {
			oh_baseline_list.push(new Baseline(removeSpecialCharacters(results[i][0]), results[i][0], results[i][1], results[i][2], results[i][3], results[i][4], results[i][5]));
		}
	}).catch(err => handleError(err))
		
}

/**
*
*	Load a scenario to the modal dialog (edit and copy)
*
**/
function loadScenario(scenarioid, iscopy){
	
	//If this is a copy, do not set the id. It will be generated new during save
	if(!iscopy)
		$("#edit_scenario_id").val(scenarioid);
	else
		$("#edit_scenario_id").val('');
	
	var code = 'data ' + oh_lib + '.filter;';
	code += 'set ' + oh_lib + '.' + oh_scenario_data + ';';
	code += 'where scenario_id="' + scenarioid + '";';
	code += 'by scenario_desc oh_report_group entry_date;';
	code += 'if last.oh_report_group;';
	code += 'run;';

	let payload = {
		action: 'datastep.runCode',
		data  : {'code': code, 'single': 'yes'}
	}

	store.runAction(currentSession, payload).then ( r => {

		params_query={'query': 'select scenario_desc, oh_report_group, oh_target_type, oh_target_value, frozen, oh_cost_per_loco, oh_inflation_rate, mwhrs_per_day from ' + oh_lib + '.filter'};
		let payload = {
			action: 'fedSql.execDirect',
			data  : params_query
		}
		
		store.runAction(currentSession, payload).then ( r => {
			var results = r.items('results', 'Result Set').toJS().rows;
			var editScenarioSettings = [];
			for(var i=0; i < results.length; i++) {
				editScenarioSettings.push(new Scenario(scenarioid, results[i][0], results[i][1], results[i][2], results[i][3], results[i][7], results[i][4], scenario_user, null, results[i][5], results[i][6]));
			}
			
			if(iscopy)
				$("#scenario_name").val(editScenarioSettings[0].scenario_desc + ' (Copy)');
			else
				$("#scenario_name").val(editScenarioSettings[0].scenario_desc);
			
			if(editScenarioSettings[0].frozen == 1 && !iscopy)
				$("#scenario_settings_button").prop("disabled", true);
			else
				$("#scenario_settings_button").prop("disabled", false);
			
			var scenarioSettings = getSettingHeader();
			scenarioSettings += getSettingTable(editScenarioSettings);
			scenarioSettings += getSettingFooter();
			$("#scenario_settings").empty();
			$("#scenario_settings").append(scenarioSettings);
			
			$('#scenario_settings_modal').modal('show');
		}).catch(err => handleError(err))

		
	}).catch(err => handleError(err))
	
}

/**
*
*	Copy a scenario
*
**/
function copyScenario(scenarioid){
	loadScenario(scenarioid, true);
}

/**
*
*	Delete a scenario
*
**/
function deleteScenario(scenarioid){

	$("#delete_scenario_id").val(scenarioid);
	$('#confirm_scenario_delete_modal').modal('show');
	
}

/**
*
*	Delete scenario submission
*
**/
$("#confirmScenarioDeleteForm").submit(function( event ) {

	event.preventDefault();

	var filter ='scenario_id="' + $("#delete_scenario_id").val() + '"';
	delete_rows={'table': { 'name': oh_scenario_data, 'caslib': oh_lib, 'where': filter}};
	let deletePayload = {
		action: 'table.deleteRows',
		data  : delete_rows
	}
	
	store.runAction(currentSession, deletePayload).then ( r => {
		loadSavedScenarios();
		$('#confirm_scenario_delete_modal').modal('hide');
		
		var modelFilter ='scenario_id="' + $("#delete_scenario_id").val() + '"';
		delete_model_rows={'table': { 'name': oh_model_out_data, 'caslib': oh_lib, 'where': modelFilter}};
		let deleteModelPayload = {
			action: 'table.deleteRows',
			data  : delete_model_rows
		}
		store.runAction(currentSession, deleteModelPayload).then ( r => {}).catch(err => handleError(err))
		
	}).catch(err => handleError(err))

});

/**
*
*	Freeze a scenario confirmation
*
**/
function freezeScenario(scenarioid){
	
	$("#freeze_scenario_id").val(scenarioid);
	$('#confirm_scenario_freeze_modal').modal('show');

	
}

/**
*
*	Freeze a scenario confirmed (submit)
*
**/
$("#confirmScenarioFreezeForm").submit(function( event ) {

	event.preventDefault();

	var filter ='scenario_id="' + $("#freeze_scenario_id").val() + '"';
	var set = [];
	set.push({'var':'frozen', 'value':'1'});
	
	freeze_scenario={'table': { 'name': oh_scenario_data, 'caslib': oh_lib, 'where': filter}, set};
	
	let payload = {
		action: 'table.update',
		data  : freeze_scenario
	}
	
	store.runAction(currentSession, payload).then ( r => {
		loadSavedScenarios();
		$('#confirm_scenario_freeze_modal').modal('hide');
	}).catch(err => handleError(err))

});

/**
*
*	Create a new scenario
*
**/
function newScenario(){
	
	var scenarioSettings = getSettingHeader();
	scenarioSettings += getSettingTable();
	scenarioSettings += getSettingFooter();
	
	$("#scenario_settings_button").prop("disabled", false);
	$("#scenario_name").val('');
	$("#edit_scenario_id").val('');
	$("#scenario_settings").empty();
	$("#scenario_settings").append(scenarioSettings);
	$('#scenario_settings_modal').modal('show');
}

/**
*
*	Generates the selectors for new, edit, and copy
*
**/
function getSettingTable(editScenarioSettings){
	var baselineSettings = '';

	for(var i=0; i < oh_baseline_list.length; i++) {
		var baseline = oh_baseline_list[i];
		
		var editScenario;
		if(editScenarioSettings){
			editScenario = getCurrentGroupingValues(editScenarioSettings, baseline.groupKey);
		}
				
		baselineSettings += '<tr>';
		baselineSettings += '<th nowrap class="align-middle" scope="row">' + baseline.reportGroup + '</th>';
		
		if(editScenario){
			if(editScenario.oh_target_type == 'years'){

				baselineSettings += '<td><select id="' + baseline.groupKey + '_target_type" name="' + baseline.groupKey + '_target_type" onchange="changeTargetSelection(this,\'' + baseline.groupKey + '\',' + editScenario.oh_target_value + ',' + baseline.mwhTarget + ');" class="form-control" style="width:120px">';
				baselineSettings += '<option selected value="years">Years</option>';
				baselineSettings += '<option value="mwhrs">Mwhrs</option>';
				
			}else{

				baselineSettings += '<td><select id="' + baseline.groupKey + '_target_type" name="' + baseline.groupKey + '_target_type" onchange="changeTargetSelection(this,\'' + baseline.groupKey + '\',' + baseline.yearTarget + ',' + editScenario.oh_target_value + ');" class="form-control" style="width:120px">';
				baselineSettings += '<option value="years">Years</option>';
				baselineSettings += '<option selected value="mwhrs">Mwhrs</option>';
				
			}
			
		}else{
			baselineSettings += '<td><select id="' + baseline.groupKey + '_target_type" name="' + baseline.groupKey + '_target_type" onchange="changeTargetSelection(this,\'' + baseline.groupKey + '\',' + baseline.yearTarget + ',' + baseline.mwhTarget + ');" class="form-control" style="width:120px">';
			baselineSettings += '<option value="years">Years</option>';
			baselineSettings += '<option value="mwhrs">Mwhrs</option>';
		}
		
		baselineSettings += '</select></td>';
		if(editScenario)
			baselineSettings += '<td><input type="number" class="form-control" id="' + baseline.groupKey + '_target_value" name="' + baseline.groupKey + '_target_value" value="' + editScenario.oh_target_value + '" /></td>';
		else
			baselineSettings += '<td><input type="number" class="form-control" id="' + baseline.groupKey + '_target_value" name="' + baseline.groupKey + '_target_value" value="' + baseline.yearTarget + '" /></td>';

		if(editScenario){
			baselineSettings += '<td><input type="number" step="0.01" class="form-control" id="' + baseline.groupKey + '_avg_mwhrs_value" name="' + baseline.groupKey + '_avg_mwhrs_value" value="' + editScenario.mwhrs_per_day + '" /></td>';
		}else{
			baselineSettings += '<td><input type="number" step="0.01" class="form-control" id="' + baseline.groupKey + '_avg_mwhrs_value" name="' + baseline.groupKey + '_avg_mwhrs_value" value="' + baseline.avgMwhPerDay + '" /></td>';

		}
		
		//Cost and Inflation
		if(editScenario){

			baselineSettings += '<td><input type="number" class="form-control" id="' + baseline.groupKey + '_cost_value" name="' + baseline.groupKey + '_cost_value" value="' + editScenario.oh_cost_per_loco + '" /></td>';
			baselineSettings += '<td><input type="number" step="0.01" class="form-control" id="' + baseline.groupKey + '_inflation_value" name="' + baseline.groupKey + '_inflation_value" value="' + editScenario.oh_inflation_rate + '" /></td>';
		
			
		}else{
			
			baselineSettings += '<td><input type="number" class="form-control" id="' + baseline.groupKey + '_cost_value" name="' + baseline.groupKey + '_cost_value" value="' + baseline.costPerLoco + '" /></td>';
			baselineSettings += '<td><input type="number" step="0.01" class="form-control" id="' + baseline.groupKey + '_inflation_value" name="' + baseline.groupKey + '_inflation_value" value="' + baseline.inflationRate + '" /></td>';
		
		}
		
		baselineSettings += '</tr>';			
	}

	return baselineSettings;
}

/**
*
*	Pull the current group settings from array
*
**/
function getCurrentGroupingValues(editScenarioSettings, groupKey){
	for(var i=0; i < editScenarioSettings.length; i++){
		if(removeSpecialCharacters(editScenarioSettings[i].oh_report_group) == groupKey){
			return editScenarioSettings[i];
		}
	}
}

/**
*
*	Set the value based on Year/Mwh selection
*
**/
function changeTargetSelection(selector, key, yr, mwh){
	if(selector.value == 'years'){
		$('#' + key + '_target_value').val(yr);
	}else{
		$('#' + key + '_target_value').val(mwh);
	}
}

/**
*
*	Cleanup special characters
*
**/
function removeSpecialCharacters(itemname){
	return itemname.replace(/[\. ,:-]+/g, "_")
}

/**
*
*	Header for new, edit, copy
*
**/
function getSettingHeader(){
	var tableheader = '<table width="100%" class="table table-sm"><thead><tr>';
	tableheader += '<th nowrap scope="col">OH Report Group</th>';
	tableheader += '<th nowrap scope="col">Target Type</th>';
	tableheader += '<th nowrap scope="col">Target Value</th>';
	tableheader += '<th nowrap scope="col">Avg Mwhrs/Day</th>';
	tableheader += '<th nowrap scope="col">Cost Per Loco</th>';
	tableheader += '<th nowrap scope="col">Inflation Rate</th>';
	tableheader += '</tr></thead><tbody>';
	return tableheader;
}

/**
*
*	Footer
*
**/
function getSettingFooter(){
	return '</tbody></table>';
}

/**
*
*	Submit new settings for a scenario
*
**/
$("#ohScenarioSettingsForm").submit(function( event ) {


	$("#scenario_settings_button").prop("disabled", true);
	$("#scenario_settings_button").html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Running Scenario...');

	event.preventDefault();
	var formvalues = $(this).serializeArray();
	var ohSettings = [];
	
	var scenarioId;
	if($("#edit_scenario_id").val() != '')
		scenarioId = $("#edit_scenario_id").val();
	else
		scenarioId = generateId();
	
	var scenarioName;
	
	for(var i=0; i < formvalues.length; i++){
		if(formvalues[i].name == 'scenario_name'){
			scenarioDesc = formvalues[i].value;
			break;
		}
	}
	
	for(var i=0; i < oh_baseline_list.length; i++) {
		
		var baseline = oh_baseline_list[i];
		var targetType;
		var targetValue;
		var costValue;
		var inflationValue;
		var avgMwhrsValue;
		
		for(var j=0; j < formvalues.length; j++){
			
			if(formvalues[j].name == baseline.groupKey + '_target_type'){
				targetType = formvalues[j].value;
			}
			
			if(formvalues[j].name == baseline.groupKey + '_target_value'){
				targetValue = formvalues[j].value;
			}
			
			if(formvalues[j].name == baseline.groupKey + '_cost_value'){
				costValue = formvalues[j].value;
			}

			if(formvalues[j].name == baseline.groupKey + '_inflation_value'){
				inflationValue = formvalues[j].value;
			}	

			if(formvalues[j].name == baseline.groupKey + '_avg_mwhrs_value'){
				avgMwhrsValue = formvalues[j].value;
			}				
						
		}

		ohSettings.push(new Scenario(scenarioId, scenarioDesc, baseline.reportGroup, targetType, targetValue, avgMwhrsValue, 0, scenario_user, null, costValue, inflationValue));
	
	}
		
	saveScenarioSettings(ohSettings);

});

/**
*
*	Save scenario settings. Even if we do an edit/update it will create a new row for each reporting group
*
**/
function saveScenarioSettings(ohSettings){
	
	var code = 'data ' + oh_lib + '.' + oh_scenario_data + '(append=yes);';
	code += 'length scenario_id $ 10;';
	code += 'length scenario_desc $ 100;';
	code += 'length oh_report_group $ 16;';
	code += 'length oh_target_type $ 9;';
	code += 'length oh_target_value 8;';
	code += 'length mwhrs_per_day 8;';
	code += 'length oh_cost_per_loco 8;';
	code += 'length oh_inflation_rate 8;';
	code += 'length frozen 8;';
	code += 'length entry_date 8;';
	code += 'length user_id $ 30;';	
	code += 'entry_date = datetime();';
	
	for(var i=0; i < ohSettings.length; i++){	
		var scenario = ohSettings[i];
		code += 'scenario_id = "' + scenario.scenario_id + '";';
		code += 'scenario_desc = "' + scenario.scenario_desc + '";';
		code += 'oh_report_group = "' + scenario.oh_report_group + '";';
		code += 'oh_target_type = "' + scenario.oh_target_type + '";';
		code += 'user_id = "' + scenario.user_id + '";';
		code += 'oh_target_value = ' + scenario.oh_target_value + ';';
		code += 'mwhrs_per_day = ' + scenario.mwhrs_per_day + ';';
		code += 'oh_cost_per_loco = ' + scenario.oh_cost_per_loco + ';';
		code += 'oh_inflation_rate = ' + scenario.oh_inflation_rate + ';';
		code += 'frozen = ' + scenario.frozen + ';';
		code += 'output;';
		code += 'call missing(scenario_id, scenario_desc, oh_report_group, oh_target_type, oh_target_value, mwhrs_per_day, frozen, user_id, oh_cost_per_loco, oh_inflation_rate);';
	}
	
	code += 'run;';

	let payload = {
		action: 'datastep.runCode',
		data  : {'code': code, 'single': 'yes'}
	}

	store.runAction(currentSession, payload).then ( r => {
		
		loadSavedScenarios();
		runScenario(ohSettings[0].scenario_id);
		
	}).catch(err => handleError(err))

}

/**
*
*	Excecute the scenario forecast code
*
**/
async function runScenario(scenario_id){
	
	$("#" + scenario_id + "_run_button").prop("disabled", true);
	$("#" + scenario_id + "_run_button").html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Running Scenario...');
	
	let { computeSetup, computeRun } = restaflib;
	let computeSession = await computeSetup(store, null);

	let macros = {"scenario_id": scenario_id};
	var code = 'cas; caslib _all_ assign;';
	code += 'data ' + oh_lib + '._&scenario_id;';
	code += 'set ' + oh_lib + '.OH_SCENARIO;';
	code += 'where scenario_id="&scenario_id";';
	code += 'by scenario_desc oh_report_group entry_date;if last.oh_report_group;';
	code += 'run;';
	code += 'filename mdlfldr filesrvc folderpath = "/BI_Projects/Mechanical/Locomotive/Models";';
	code += '%include mdlfldr("macro_nextOhSchedule.sas");';
	code += '%model_nextOhSchedule(in_engSummary = ' + oh_lib + '.abt_engineChangeoutSummary,scenario_config = ' + oh_lib + '._&scenario_id,out_nextoh = ' + oh_lib + '.' + oh_model_out_data + ');';

	let computeSummary = await computeRun(
		store,
		computeSession,
		code,
		macros,
		15,2 
	);
  
	let log = await restaflib.computeResults(store, computeSummary, 'log');
	for(var i=0; i < log.length; i++){
		console.info(log[i].line);
	}

	$("#" + scenario_id + "_run_button").prop("disabled", false);
	$("#" + scenario_id + "_run_button").html('<img src="images/refresh.png">&nbsp;Run Scenario');
	$("#scenario_settings_button").prop("disabled", false);
	$("#scenario_settings_button").html('Run Scenario');
	$('#scenario_settings_modal').modal('hide');

	setStatusMessage('Overhaul forecasting model completed', 'success');

}

/**
*
*	Load saved scenarios and display the cards in the UI
*
**/
function loadSavedScenarios(){

	//Get the most current scenarios (using datastep here due to lack of group filtering capabilities in FedSQL)
	var code = 'data ' + oh_lib + '.current_scenarios;';
	code += 'set ' + oh_lib + '.' + oh_scenario_data + '(keep=scenario_id scenario_desc user_id frozen entry_date);';
	code += 'by scenario_id entry_date;';
	code += 'if last.scenario_id;';
	code += 'run;';

	let payload = {
		action: 'datastep.runCode',
		data  : {'code': code, 'single': 'yes'}
	}
	
	store.runAction(currentSession, payload).then ( r => {
		params_query={'query': 'select scenario_id, scenario_desc, user_id, put(max(entry_date), datetime.), max(entry_date), frozen from ' + oh_lib + '.current_scenarios group by scenario_id, scenario_desc, user_id, frozen order by 5 desc'};		
		let payload = {
			action: 'fedSql.execDirect',
			data  : params_query
		}

		store.runAction(currentSession, payload).then ( r => {
			$("#scenario_list").empty();
			var results = r.items('results', 'Result Set').toJS().rows;
			for(var i=0; i < results.length; i++) {
				getScenarioCard(new Scenario(results[i][0], results[i][1], null, null, null, null, results[i][5], results[i][2], results[i][3]));
			}
		}).catch(err => handleError(err))		
		
	}).catch(err => handleError(err))


}

/**
*
*	Get a bootstrap card for each scenario
*
**/
function getScenarioCard(scenario){
	var scenarioCard = '';
	scenarioCard +='<div class="card border border-body">';
	scenarioCard +='<h6 class="card-title bg-light text-body text-center" style="padding-bottom: 10px;padding-top: 10px;">';
	scenarioCard +='<img class="float-left" style="margin-left: 10px;" src="images/scenario.png"/>' + scenario.scenario_desc;
	scenarioCard +='</h6>';
	scenarioCard +='<div class="card-body" style="margin-top: -10px;">';
	scenarioCard +='<h6 class="text-secondary">Last Edited <small>' + scenario.datetime + '</small></h6>';
	scenarioCard +='<h6 class="text-secondary">Edited By <small>' + scenario.user_id + '</small></h6>';
	if(scenario.frozen == 0)
		scenarioCard +='<h6 class="text-secondary">Frozen <small>False</small></h6>';
	else
		scenarioCard +='<h6 class="text-secondary">Frozen <small>True</small></h6>';
	scenarioCard +='</div>';
	scenarioCard +='<div class="card-footer text-muted">';
	scenarioCard +='<button type="button" class="btn btn-light btn-sm float-right" onclick="deleteScenario(\'' + scenario.scenario_id + '\');"><img src="images/trash.png"/>&nbsp;Delete</button>';
	scenarioCard +='<button type="button" class="btn btn-light btn-sm float-right" onclick="copyScenario(\'' + scenario.scenario_id + '\');"><img src="images/copy.png"/>&nbsp;Copy</button>';
	scenarioCard +='<button type="button" class="btn btn-light btn-sm float-right" onclick="loadScenario(\'' + scenario.scenario_id + '\');"><img src="images/edit.png"/>&nbsp;Edit</button>';
	if(scenario.frozen == 0){
		scenarioCard +='<button type="button" class="btn btn-light btn-sm float-right" onclick="freezeScenario(\'' + scenario.scenario_id + '\');"><img src="images/freeze.png"/>&nbsp;Freeze</button>';
	}
	scenarioCard +='<button type="button" id="' + scenario.scenario_id + '_run_button" class="btn btn-light btn-sm float-right" onclick="runScenario(\'' + scenario.scenario_id + '\');" style="margin-left: 10px;"><img src="images/refresh.png">&nbsp;Run Scenario</button>';
	scenarioCard +='</div>';
	scenarioCard +='</div>';
	$("#scenario_list").append(scenarioCard);
	
}

/**
*
*	Generate a unique id
*
**/
function generateId(){
	
    var characters = '23456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var id_length = 10;
    var rtn = '';
    for (var i = 0; i < id_length; i++) {
      rtn += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return rtn;
	
}

/**
*
*	Clear status messages
*
**/
function clearStatusMessage(){
	
  $("#status_message").empty();

}

/**
*
*	Set status messages (warning, success, danger). Clears after 5 seconds
*
**/
function setStatusMessage(message, type){

	clearStatusMessage();
	$("#status_message").append('<div class="alert alert-' + type + ' alert-dismissible col-sm-12" role="alert"><a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>' + message + '</div>');	

    setTimeout(function () {
		clearStatusMessage();
    }, 10000);

}

/**
*
*	Global function to handle any errors tha occur
*
**/
function handleError(err){

	$("#status_message").empty();
	$("#status_message").append('<div class="alert alert-danger alert-dismissible col-sm-12" role="alert"><a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>An error has occured: ' + err + '</div>');
	console.log('OH Scenario Error: ' + err);

}

/**
*
*	Baseline object - maps to OH_SCENARIO_BASELINE
*
**/
function Baseline(groupKey, reportGroup, yearTarget, mwhTarget, avgMwhPerDay, costPerLoco, inflationRate){
	this.groupKey = groupKey;
	this.reportGroup = reportGroup;
	this.yearTarget = yearTarget;
	this.mwhTarget = mwhTarget;
	this.avgMwhPerDay = avgMwhPerDay;
	this.costPerLoco = costPerLoco;
	this.inflationRate = inflationRate;
}

/**
*
*	Scenario object - maps to OH_SCENARIO
*
**/
function Scenario(scenario_id, scenario_desc, oh_report_group, oh_target_type, oh_target_value, mwhrs_per_day, frozen, user_id, datetime, oh_cost_per_loco, oh_inflation_rate){
	this.scenario_id = scenario_id;
	this.scenario_desc = scenario_desc;
	this.oh_report_group = oh_report_group;
	this.oh_target_type = oh_target_type;
	this.oh_target_value = oh_target_value;
	this.oh_cost_per_loco = oh_cost_per_loco;
	this.oh_inflation_rate = oh_inflation_rate;
	this.mwhrs_per_day = mwhrs_per_day;
	this.frozen = frozen;
	this.user_id = user_id;
	this.datetime = datetime;
}
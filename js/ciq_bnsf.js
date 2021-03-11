/**
*
*	Author:   Matthew Perry (matthew.perry@sas.com)
*	Company:  SAS Institute
*	Dev Date: 9/30/2020
*	Desc:     This JavaScript handles the iteraction between the CIQ assessment forms and the Viya backend. All data is stored in promoted CAS tables
*
**/

var currentSession;

var viyahost = window.location.origin;
//var viyahost = 'https://viya.sasviya.bnsf.com';
var ciq_lib = 'CIQ';

var ciq_user;

var adp_data = 'ADP_DATA';
var assessor_data = 'ASSESSORS';
var question_key = 'QUESTION_KEY';
var ciq_results = "CIQ_DATA_ENTRY_RESULTS";
var assessment_status = 0;
var ciq_gap_inputs = 'CIQ_GAP_INPUTS';
var tc_max_data = "TCMAX_DATA";
var rule_one_gage_min = 21;

/* Arrays to hold the static data */
var adp_list = [];
var assessors = [];
var form_types = [];
var form_questions = [];
var form_topics = [];


/**
*
*	Initialize the connection to the Viya backend. Leverages the authentication from the browser.
*
**/
async function appInit(){

	let p = {
	  authType: 'server',
	  host: viyahost
	}
    let msg = await store.logon(p);
    let {casManagement} = await store.addServices ('casManagement');
    let servers = await store.apiCall(casManagement.links('servers'));
    let serverName = servers.itemsList(0);
    let session = await store.apiCall(servers.itemsCmd(serverName, 'createSession'));
	
	let { identities } = await store.addServices('identities');
    let c = await store.apiCall(identities.links('currentUser'));
	ciq_user = c.items('id');
		
    return session;
}

/**
*
*	Loads the initial data (form types, questions, etc...)
*
**/
function loadSelectionData(){

	appInit().then ( session => {
		  currentSession = session;
		  loadADPData();
		  loadAssessors();
		  loadFormTypes();
		  document.querySelector("#form_date").valueAsDate = new Date();
	}).catch( err => handleError(err));

}

/**
*
*	Toggle between pending/in-progress and approved assessments
*
**/
function changeAssessmentStatus(selector){
	
	if(selector.value == 'approved'){
		assessment_status = 1;
	}else{
		assessment_status = 0;
	}
	loadAssessment();
	
}

/**
*
*	Function determines if all required fields are selected and load any existing assessment entries
*
**/
function loadAssessment(){

	clearFormFields();

	if(isFormComplete()){
		
		params_query={'query': 'select question_key, sample, eqp_ood, tracker_ood, cert_missing, exceptions, compliance, opportunity, findings, corrective_action, champion, put(timeframe, yymmdd10.)  from ' + ciq_lib + '.' + ciq_results + ' where form_key=\'' + getFormKey() + '\' AND assessment_approved=' + assessment_status +''};
		let payload = {
			action: 'fedSql.execDirect',
			data  : params_query
		}
			
		var currentAssessmentValues = [];
		store.runAction(currentSession, payload).then ( r => {
			current_entries = r.items('results', 'Result Set').toJS().rows;
			
			for(var i=0; i < current_entries.length; i++) {
				currentAssessmentValues.push(new Assessment(null, null, null, null, null, null, null, null, current_entries[i][1], 
											 current_entries[i][2], current_entries[i][3], current_entries[i][4],
											 current_entries[i][5], current_entries[i][6], current_entries[i][7], 
											 current_entries[i][8], current_entries[i][9], current_entries[i][10], 
											 current_entries[i][11], current_entries[i][0]));
			}
			
			loadAssessmentFormData(currentAssessmentValues);
			disableFormFields(false);
			
		}).catch(err => handleError(err))
		
	}else{
		
		disableFormFields(true);
		
	}
	
	isReadyForApproval();
	checkCIQEpoch();
	
}

/**
*
*	This clears the car/loco fields. It doesn not affect the items used for form key generation
*
**/
function clearFormFields(){

	for(var i=0;  i < form_questions.length; i++){
		var question_key = form_questions[i][5];
		$('input[id^="' + question_key + '"]').each(function() {
			
			if(this.type == 'number')
				this.value = 0;
			else if(this.type == 'date')
				this.value = null;
			else if(this.type == 'radio')
				this.checked = false;

		});
		
		$('textarea[name^="' + question_key + '"]').each(function() {
			this.value = '';
		});
		
	}
	
	clearStatusMessage();
}

/**
*
*	This disables or enables the form fields
*
**/
function disableFormFields(disabled){
		
	if(getStation() == 'Havelock' || getStation() == 'Topeka')
		$("input.numspinner").attr("disabled",false);	
	else
		$("input.numspinner").attr("disabled",true);
	
	for(var i=0;  i < form_questions.length; i++){
		var question_key = form_questions[i][5];
		$('input[id^="' + question_key + '"]').each(function() {
			
			if(this.type == 'date' || this.type == 'radio')
				$(this).prop( "disabled", disabled );

		});
		
		$('textarea[name^="' + question_key + '"]').each(function() {
			$(this).prop( "disabled", disabled );
		});
		
	}	
	
}

/**
*
*	Load the CIQ user interface from assessment objects
*
**/
function loadAssessmentFormData(assessmentData){
	
	for(var i=0; i < assessmentData.length; i++){

		var question_key = assessmentData[i].question_key;
		
		$('#' + question_key + '_sample').val(assessmentData[i].sample);
		$('#' + question_key + '_equipment_ood').val(assessmentData[i].eqp_ood);
		$('#' + question_key + '_tracker_ood').val(assessmentData[i].tracker_ood);
		$('#' + question_key + '_cert_missing').val(assessmentData[i].cert_missing);
		$('#' + question_key + '_exceptions').val(assessmentData[i].exceptions);
		
		$('#' + question_key + '_findings').val(assessmentData[i].findings);
		$('#' + question_key + '_corrective_action').val(assessmentData[i].corrective_action);
		$('#' + question_key + '_champion').val(assessmentData[i].champion);

		try{
			document.querySelector('#' + question_key + '_timeframe').valueAsDate = getJSDate(assessmentData[i].timeframe);
		}catch(err){
			console.log('Unable to parse a timeframe date');
		}

		if(assessmentData[i].compliance == 1)
			$('input[name=' + question_key + '_check][value=compliance]').prop('checked', true);
		else if(assessmentData[i].opportunity == 1)
			$('input[name=' + question_key + '_check][value=opportunity]').prop('checked', true);
		
	}
	
}

/**
*
*	Determine if all of the required form elements are selected
*
**/
function isFormComplete(){
	
	if(getFormType() && getAssessmentType() && getCMO() && getDivision() && getStation() && getAssessmentDate()){	
		return true;
	}else{
		return false;
	}
	
}

/**
*
*	Loads the ADP data which conists of CMO, division, station, and station codes for cars/locos
*	These station codes are used for filtering TCMax data when the GAP form is opened
*
**/
function loadADPData(){

	params_tableLoad={'table': { 'name': adp_data, 'caslib': ciq_lib}, 'to': 1000};
	let payload = {
		action: 'table.fetch',
		data  : params_tableLoad
	}

	store.runAction(currentSession, payload).then ( r => {
		adp_list = r.items('results', 'Fetch').toJS().rows;
		var prompts = getUniqueADPValues();
		for(var i=0; i < prompts.length; i++) {
			$('#cmo_select').append('<option value="' + prompts[i] + '">' + prompts[i] + '</option>');
		}
	}).catch(err => handleError(err))

}

/**
*
*	Loads unique select/combo lists for CMO, division, stations
*
**/
function loadSelections(selector){
	var selections = [];
	var prompts = [];

	var selectorId = selector.id;
	var selectorVal = selector.value;

	if(selectorId == 'cmo_select'){

		cleanupSelector("division_select");
		cleanupSelector("station_select");

		selections.push(selectorVal);
		prompts = getUniqueADPValues(selectorId, selections);
		for(var i=0; i < prompts.length; i++) {
			$('#division_select').append('<option value="' + prompts[i] + '">' + prompts[i] + '</option>');
		}

	}else if(selectorId == 'division_select'){

		cleanupSelector("station_select");

		selections.push(getCMO());
		selections.push(selectorVal);

		prompts = getUniqueADPValues(selectorId, selections);
		for(var i=0; i < prompts.length; i++) {
			var stationcode = prompts[i];
			var station = stationcode.substr(0, stationcode.indexOf('_'));
			var code = stationcode.substr(stationcode.indexOf('_') + 1);
			$('#station_select').append('<option value="' + code + '">' + station + '</option>');
		}

	}
}

/**
*
*	Utility function that supports the cascading prompts for cmo, division, station (loco/cars are different codes)
*
**/
function getUniqueADPValues(level, selections){

	var prompts = [];

	if(level == null){

		for(var i=0; i < adp_list.length; i++) {
			var adp_value = adp_list[i][1];
			if(!prompts.includes(adp_value))
				prompts.push(adp_value);
		}

	}else if(level == 'cmo_select'){

		for(var i=0; i < adp_list.length; i++) {
			if(adp_list[i][1] == selections[0]){
				var division = adp_list[i][2];
				if(!prompts.includes(division))
					prompts.push(division);
			}
		}

	}else if(level == 'division_select'){

		for(var i=0; i < adp_list.length; i++) {
			if(adp_list[i][1] == selections[0] && adp_list[i][2] == selections[1]){
				
				//Depending on the form type, the shop codes are different
				var station_code = '';
				if(getFormType() == 'Car'){
					station_code = adp_list[i][3] + '_' + adp_list[i][4];
				}else if(getFormType() == 'Loco'){
					station_code = adp_list[i][3] + '_' + adp_list[i][5];
				}

				if(!prompts.includes(station_code))
					prompts.push(station_code);
			}
		}

	}

	return prompts;
}

/**
*
*	Loads the assessors and the types of assessments they do
*
**/
function loadAssessors(){

	params_query={'query': 'select name, assessment_type from ' + ciq_lib + '.' + assessor_data + ' order by name asc'};
	let payload = {
		action: 'fedSql.execDirect',
		data  : params_query
	}

	store.runAction(currentSession, payload).then ( r => {
		assessors = r.items('results', 'Result Set').toJS().rows;
		for(var i=0; i < assessors.length; i++) {
			$('#assessor').append('<option value="' + assessors[i][0] + '">' + assessors[i][0] + '</option>');
		}

	}).catch(err => handleError(err))
	
}

/**
*
*	When an accessor is selected, the assessment type is auto populated
*
**/
function loadAccessorType(selector){
		
	var assessor = selector.value;
	for(var i=0; i < assessors.length; i++) {
		
		if(assessors[i][0] == assessor){
			$('#assessment_type').val(assessors[i][1]);
			break;
		}
		
	}
}


/**
*
*	Loads the various form types (loco/cars)
*
**/
function loadFormTypes(){

	params_query={'query': 'select distinct form_type from ' + ciq_lib + '.' + question_key};
	let payload = {
		action: 'fedSql.execDirect',
		data  : params_query
	}

	store.runAction(currentSession, payload).then ( r => {
		form_types = r.items('results', 'Result Set').toJS().rows;
		for(var i=0; i < form_types.length; i++) {
			$('#form_type').append('<option value="' + form_types[i][0] + '">' + form_types[i][0] + '</option>');
		}

	}).catch(err => handleError(err))

}

/**
*
*	Loads unique select/combo lists for CMO, division, stations
*
**/
function loadSelections(selector){
	var selections = [];
	var prompts = [];

	var selectorId = selector.id;
	var selectorVal = selector.value;

	if(selectorId == 'cmo_select'){

		cleanupSelector("division_select");
		cleanupSelector("station_select");

		selections.push(selectorVal);
		prompts = getUniqueADPValues(selectorId, selections);
		for(var i=0; i < prompts.length; i++) {
			$('#division_select').append('<option value="' + prompts[i] + '">' + prompts[i] + '</option>');
		}

	}else if(selectorId == 'division_select'){

		cleanupSelector("station_select");

		selections.push(getCMO());
		selections.push(selectorVal);

		prompts = getUniqueADPValues(selectorId, selections);
		for(var i=0; i < prompts.length; i++) {
			var stationcode = prompts[i];
			var station = stationcode.substr(0, stationcode.indexOf('_'));
			var code = stationcode.substr(stationcode.indexOf('_') + 1);
			$('#station_select').append('<option value="' + code + '">' + station + '</option>');
		}

	}
}

/**
*
*	Cleanup a selector
*
**/
function cleanupSelector(selectorid){

	$("#" + selectorid + " option").each(function(){
		if(this.value != '') this.remove();
	});

}

/**
*
*	Loads the questions and their keys. Resets the entire form.
*
**/

function loadQuestionKey(formtype){

	var filter ='form_type="' + formtype + '" and question_active=1';
	let payload = {
		action: 'table.fetch',
		data  : {'table': { 'name': question_key, 'caslib': ciq_lib, 'where': filter}, 'to': 1000}
	}

	store.runAction(currentSession, payload).then ( r => {
		form_questions = r.items('results', 'Fetch').toJS().rows;
		cleanupSelector('division_select');
		cleanupSelector('station_select');
		$("#cmo_select").prop('selectedIndex',0);
		loadDistinctTopics();
		displayFormQuestions();
		disableFormFields(true);
	}).catch(err => handleError(err))

}

/**
*
*	Process a data change request. This could result in a new row or an updated row in the pending assessment table
*
**/
function processAssessmentData(assessment){
				
	//1) Determine if form_key and question_key row exists. Should only ever be one row for this combo
	params_query={'query': 'select count(*) from ' + ciq_lib + '.' + ciq_results + ' WHERE form_key=\'' + assessment.form_key + '\' AND question_key=\'' + assessment.question_key + '\' AND assessment_approved=' + assessment_status +''};
	let payload = {
		action: 'fedSql.execDirect',
		data  : params_query
	}

	store.runAction(currentSession, payload).then ( r => {
		assessmentCount = r.items('results', 'Result Set').toJS().rows[0][0];
		if(assessmentCount == 1){
			
			//2) If it exists, do an update
			updateAssessmentData(assessment);
			
		}else{
			
			//3) If not, do an insert
			insertAssessmentData(assessment);
			
		}
		
	}).catch(err => handleError(err))
	

}

/**
*
*	Update an existing assessment row
*
**/
function updateAssessmentData(assessment){

	var filter ='form_key="' + assessment.form_key + '" AND question_key="' + assessment.question_key + '" AND assessment_approved=' + assessment_status +'';
	var set = [];
	if(assessment.sample !== null)
		set.push({'var':'sample', 'value':'' + assessment.sample + ''});
	
	if(assessment.eqp_ood !== null)
		set.push({'var':'eqp_ood', 'value':'' + assessment.eqp_ood + ''});

	if(assessment.tracker_ood !== null)
		set.push({'var':'tracker_ood', 'value':'' + assessment.tracker_ood + ''});

	if(assessment.cert_missing !== null)
		set.push({'var':'cert_missing', 'value':'' + assessment.cert_missing + ''});

	if(assessment.exceptions !== null)
		set.push({'var':'exceptions', 'value':'' + assessment.exceptions + ''});	
	
	if(assessment.findings !== null)
		set.push({'var':'findings', 'value':JSON.stringify(assessment.findings)});	

	if(assessment.corrective_action !== null)
		set.push({'var':'corrective_action', 'value':JSON.stringify(assessment.corrective_action)});	
	
	if(assessment.champion !== null)
		set.push({'var':'champion', 'value':JSON.stringify(assessment.champion)});		
	
	if(assessment.compliance !== null)
		set.push({'var':'compliance', 'value':'' + assessment.compliance + ''});

	if(assessment.opportunity !== null)
		set.push({'var':'opportunity', 'value':'' + assessment.opportunity + ''});
	
	if(assessment.timeframe !== null)
		set.push({'var':'timeframe', 'value':'' + assessment.timeframe + ''});	
	
	update_assessment_data={'table': { 'name': ciq_results, 'caslib': ciq_lib, 'where': filter}, set};
	
	let payload = {
		action: 'table.update',
		data  : update_assessment_data
	}
	
	store.runAction(currentSession, payload).then ( r => {}).catch(err => handleError(err))
	
}

/**
*
*	Insert a new assessment row. CAS appends can be tricky. The length statements verify that the appended data matches exactly to the base table.
*
**/
function insertAssessmentData(assessment){

	var code = 'data ' + ciq_lib + '.' + ciq_results + '(append=yes);';
	code += 'length form_key varchar(55);';
	code += 'length form_type varchar(4);';
	code += 'length assessment_type cmo_select varchar(50);';
	code += 'length division_select varchar(3) station_select varchar(12);';
	code += 'length assessor varchar(50);';
	code += 'length form_date 8;';
	code += 'length sample eqp_ood tracker_ood cert_missing exceptions compliance opportunity 8;';
	code += 'length findings corrective_action champion varchar(255);';
	code += 'length timeframe 8;';
	code += 'length question_key varchar(18);';
	code += 'length LOD_Question_Calc 8;';
	code += 'length date_approved assessment_approved 8;';
	code += 'length approved_by varchar(55);';	

	code += 'form_key = "' + assessment.form_key + '";';
	code += 'LOD_Question_Calc = 0;';
	code += 'form_type = "' + assessment.form_type + '";';
	code += 'assessment_type = "' + assessment.assessment_type + '";';
	code += 'cmo_select = "' + assessment.cmo_select + '";';
	code += 'division_select = "' + assessment.division_select + '";';
	code += 'station_select = "' + assessment.station_select + '";';
	code += 'assessor = "' + assessment.assessor + '";';
	code += 'form_date=input("' + assessment.form_date + '", yymmdd10.);';
	code += 'question_key = "' + assessment.question_key + '";';
	code += 'assessment_approved=0;'; //What is this is an approved assessment being modified? 
	code += 'date_approved=.;';
	code += 'approved_by="";';
	
	if(assessment.sample !== null)
		code += 'sample = ' + assessment.sample + ';';
	else
		code += 'sample = 0;';
	
	if(assessment.eqp_ood !== null)
		code += 'eqp_ood = ' + assessment.eqp_ood + ';';
	else
		code += 'eqp_ood = 0;';

	if(assessment.tracker_ood !== null)
		code += 'tracker_ood = ' + assessment.tracker_ood + ';';
	else
		code += 'tracker_ood = 0;';

	if(assessment.cert_missing !== null)
		code += 'cert_missing = ' + assessment.cert_missing + ';';
	else
		code += 'cert_missing = 0;';
	
	if(assessment.exceptions !== null)
		code += 'exceptions = ' + assessment.exceptions + ';';
	else
		code += 'exceptions = 0;';

	if(assessment.compliance !== null)
		code += 'compliance = ' + assessment.compliance + ';';
	else
		code += 'compliance = .;';

	if(assessment.opportunity !== null)
		code += 'opportunity = ' + assessment.opportunity + ';';
	else
		code += 'opportunity = .;';
	
	if(assessment.findings !== null)
		code += 'findings = "' + assessment.findings + '";';
	else
		code += 'findings = "";';
	
	if(assessment.corrective_action !== null)
		code += 'corrective_action = "' + assessment.corrective_action + '";';
	else
		code += 'corrective_action = "";';
	
	if(assessment.champion !== null)
		code += 'champion = "' + assessment.champion + '";';
	else
		code += 'champion = "";';
	
	if(assessment.timeframe !== null)
		code += 'timeframe=input("' + assessment.timeframe + '", yymmdd10.);';
	else
		code += 'timeframe=.;';

	code += 'run;';

	let payload = {
		action: 'datastep.runCode',
		data  : {'code': code, 'single': 'yes'}
	}

	store.runAction(currentSession, payload).then ( r => {}).catch(err => handleError(err))

}

/**
*
*	This function is called when a form field is changed on the assessment (timeframe, compliance, opportunity, findings, corrective_action, champion, etc..)
*	Updates data on the fly. This is why we no longer have the "submit assessment form button"
*
**/
function dataChange(inputselector, nochecks){
		
	var selectorId = inputselector.id;
	var assessment = new Assessment(getFormKey(), getFormType(), getAssessmentType(), getCMO(), getDivision(), getStation(), getAssessor(), getAssessmentDate(), null, null, null, null, null, null, null, null, null, null, null, null, null);	
										

	if(inputselector.type == 'date'){
		
		assessment.question_key = selectorId.substr(0, selectorId.indexOf('_timeframe'));
		assessment.timeframe = getSASDays(inputselector.value);
		
	}else if(inputselector.type == 'radio'){
		
		assessment.question_key = selectorId.substr(0, selectorId.indexOf('_check'));
		
		if(nochecks){
			//Special case where a radio was checked and then needed removal
			assessment.compliance = 0;
			assessment.opportunity = 0;
		}else{
			if(inputselector.value == 'compliance'){
				assessment.compliance = 1;
				assessment.opportunity = 0;
			}else{
				assessment.compliance = 0;
				assessment.opportunity = 1;			
			}
		}
			
	
	}else if(inputselector.type == 'textarea'){
		
		if(selectorId.endsWith('_findings')){		
			assessment.question_key = selectorId.substr(0, selectorId.indexOf('_findings'));
			assessment.findings = inputselector.value;		
		}else if(selectorId.endsWith('_corrective_action')){					
			assessment.question_key = selectorId.substr(0, selectorId.indexOf('_corrective_action'));
			assessment.corrective_action = inputselector.value;		
		}else if(selectorId.endsWith('_champion')){
			assessment.question_key = selectorId.substr(0, selectorId.indexOf('_champion'));
			assessment.champion = inputselector.value;	
		}
		
	}else if(inputselector.type == 'number'){
	
		if(selectorId.endsWith('_sample')){
			assessment.question_key = selectorId.substr(0, selectorId.indexOf('_sample'));
			assessment.sample = inputselector.value;		
		}else if(selectorId.endsWith('_equipment_ood')){
			assessment.question_key = selectorId.substr(0, selectorId.indexOf('_equipment_ood'));
			assessment.eqp_ood = inputselector.value;		
		}else if(selectorId.endsWith('_tracker_ood')){
			assessment.question_key = selectorId.substr(0, selectorId.indexOf('_tracker_ood'));
			assessment.tracker_ood = inputselector.value;		
		}else if(selectorId.endsWith('_cert_missing')){
			assessment.question_key = selectorId.substr(0, selectorId.indexOf('_cert_missing'));
			assessment.cert_missing = inputselector.value;		
		}else if(selectorId.endsWith('_exceptions')){
			assessment.question_key = selectorId.substr(0, selectorId.indexOf('_exceptions'));
			assessment.exceptions = inputselector.value;		
		}
		
	}

	processAssessmentData(assessment);

}

/**
*
*	Utility method to determine the SAS days between two dates
*
**/
function getSASDays(timeframe){
	
	var sasEpoch = new Date("01/01/1960"); 
	var enteredDate = new Date(timeframe);
	return Math.ceil((enteredDate.getTime() - sasEpoch.getTime()) / (1000 * 3600 * 24)); 
	
}

/**
*
*	Displays the questions for the selected type (car/loco)
*
**/
function displayFormQuestions(){
	$("#question_div").empty();

	var html = '';

	html += "<table width='100%'>";
	html += "<tr class='tbloutline'><td colspan=12 class='tblbackground'><i>Management has established processes and standards to monitor compliance.</i></td></tr>";

	for(var i=0; i < form_topics.length; i++) {

		var topic = form_topics[i];
		var questions = getTopicQuestions(topic);

		if(questions[0][6] == 'review'){
			html += getReviewHeader(topic);
			for(var j=0; j < questions.length; j++){
				html += getReviewRow(questions[j]);
			}
		}else{
			html += getComplianceHeader(topic);

			for(var j=0; j < questions.length; j++){
				html += getComplianceRow(questions[j]);
			}
		}

	}
	html += "</table>";

	$("#question_div").append(html);

}

/**
*
*	Header for questions 1-3 (not 4)TCMax)
*
**/
function getReviewHeader(topic){

	var header = '';
	header += "<tr class='tblbackground'>";
	header += "<td width='15%' colspan=2 class='tbloutline tblvcenter tblheader'>" + topic + "</td>";
	header += "<td width='5%' class='tbloutline tblcenter tblvcenter tblheader'>Sample</td>";
	header += "<td width='5%' class='tbloutline tblcenter tblvcenter tblheader'>Equipment OOD</td>";
	header += "<td width='5%' class='tbloutline tblcenter tblvcenter tblheader'>Tracker OOD</td>";
	header += "<td width='5%' class='tbloutline tblcenter tblvcenter tblheader'>Cert Missing</td>";
	header += "<td width='5%' class='tbloutline tblcenter tblvcenter tblheader'>Exceptions</td>";
	header += "<td width='15%' class='tbloutline tblcenter tblvcenter tblheader'>Findings</td>";
	header += "<td width='10%' class='tbloutline tblcenter tblvcenter tblheader'>Corrective Action</td>";
	header += "<td width='10%' class='tbloutline tblcenter tblvcenter tblheader'>Champion</td>";
	header += "<td width='10%' class='tbloutline tblcenter tblvcenter tblheader'>Timeframe</td>";
	header += "</tr>";

	return header;
}

/**
*
*	Rows for questions 1-3 (not 4)TCMax)
*
**/
function getReviewRow(question){
	
	var question_id = question[5];
	var row = '';
	
	row += "<tr>";
	row += "<td width='15%' class='tbloutline tblvcenter'>" + question[7] + "</td>";
	row += "<td width='5%' class='tbloutline tblvcenter' align='center'><button type='button' id=\"gap_button_" + question_id + "\" class='btn btn-outline-secondary' onclick='loadTCMaxForm(\"" + question_id + "\", \"" + question[7] + "\")'><img src='images/form.png'/></button></td>";
	row += "<td width='5%' class='tbloutline tblcenter tblvcenter'><input id='" + question_id + "_sample' name='" + question_id + "_sample' type='number' disabled step='1' value='0' min='0' class='numspinner'/></td>";
	row += "<td width='5%' class='tbloutline tblcenter tblvcenter'><input id='" + question_id + "_equipment_ood' name='" + question_id + "_equipment_ood' type='number' disabled step='1' value='0' min='0' class='numspinner'/></td>";
	row += "<td width='5%' class='tbloutline tblcenter tblvcenter'><input id='" + question_id + "_tracker_ood' name='" + question_id + "_tracker_ood' type='number' disabled step='1' value='0' min='0' class='numspinner'/></td>";
	row += "<td width='5%' class='tbloutline tblcenter tblvcenter'><input id='" + question_id + "_cert_missing' name='" + question_id + "_cert_missing' type='number' disabled step='1' value='0' min='0' class='numspinner'/></td>";
	row += "<td width='5%' class='tbloutline tblcenter tblvcenter'><input id='" + question_id + "_exceptions' name='" + question_id + "_exceptions' type='number' disabled step='1' value='0' min='0' class='numspinner'/></td>";
	row += "<td width='15%' class='tbloutline tblcenter tblvtop'><textarea maxlength='255' onchange='dataChange(this);' name='" + question_id + "_findings' id='" + question_id + "_findings'></textarea></td>";
	row += "<td width='10%' class='tbloutline tblcenter tblvtop'><textarea maxlength='255' onchange='dataChange(this);' name='" + question_id + "_corrective_action' id='" + question_id + "_corrective_action'></textarea></td>";
	row += "<td width='10%' class='tbloutline tblcenter tblvtop'><textarea maxlength='255' onchange='dataChange(this);' name='" + question_id + "_champion' id='" + question_id + "_champion'></textarea></td>";
	row += "<td width='10%' class='tbloutline tblcenter tblvcenter'><input type='date' class='form-control' onchange='dataChange(this);' id='" + question_id + "_timeframe' name='" + question_id + "_timeframe'></td>";
	row += "</tr>";

	return row;
	
}

/**
*
*	Header for compliance questions
*
**/
function getComplianceHeader(topic){

	var header = '';
	header += "<tr class='tblbackground'>";
	header += "<td width='15%' colspan=2 class='tbloutline tblvcenter tblheader'>" + topic + "</td>";
	header += "<td width='5%' colspan=3 class='tbloutline tblcenter tblvcenter tblheader'>Compliance</td>";
	header += "<td width='5%' colspan=2 class='tbloutline tblcenter tblvcenter tblheader'>Opportunity</td>";
	header += "<td width='15%' class='tbloutline tblcenter tblvcenter tblheader'>Findings</td>";
	header += "<td width='15%' class='tbloutline tblcenter tblvcenter tblheader'>Corrective Action</td>";
	header += "<td width='10%' class='tbloutline tblcenter tblvcenter tblheader'>Champion</td>";
	header += "<td width='10%' class='tbloutline tblcenter tblvcenter tblheader'>Timeframe</td>";
	header += "</tr>";

	return header;

}

/**
*
*	Rows for compliance questions
*
**/
function getComplianceRow(question){

	var row = '';
	var question_id = question[5];

	row += "<tr>";
	row += "<td width='15%' colspan=2 class='tbloutline tblvcenter'>" + question[7] + "</td>";
	row += "<td width='5%' colspan=3 class='tbloutline tblcenter tblvcenter'><input name='" + question_id + "_check' onchange='dataChange(this);' id='" + question_id + "_check' value='compliance' class='form-control' type='radio' onclick='toggleRadio(this);'></td>";
	row += "<td width='5%' colspan=2 class='tbloutline tblcenter tblvcenter'><input name='" + question_id + "_check' onchange='dataChange(this);' id='" + question_id + "_check' value='opportunity' class='form-control' type='radio' onclick='toggleRadio(this);'></td>";
	row += "<td width='15%' class='tbloutline tblcenter tblvtop'><textarea maxlength='255' onchange='dataChange(this);' name='" + question_id + "_findings' id='" + question_id + "_findings'></textarea></td>";
	row += "<td width='15%' class='tbloutline tblcenter tblvtop'><textarea maxlength='255' onchange='dataChange(this);' name='" + question_id + "_corrective_action' id='" + question_id + "_corrective_action'></textarea></td>";
	row += "<td width='10%' class='tbloutline tblcenter tblvtop'><textarea maxlength='255' onchange='dataChange(this);' name='" + question_id + "_champion' id='" + question_id + "_champion'></textarea></td>";
	row += "<td width='10%' class='tbloutline tblcenter tblvcenter'><input type='date' class='form-control' onchange='dataChange(this);' id='" + question_id + "_timeframe' name='" + question_id + "_timeframe'></td>";
	row += "</tr>";

	return row;

}

/**
*
*	Special request. Radio button could be selected by accident. A second selection needs to completly remove the radio check.
*
**/
function toggleRadio(thisradio){
	var secondClick = true;
	$(thisradio).change(function() {
		secondClick = false;
		$(thisradio).prop("checked", true);
	});
	$(thisradio).click(function() {
		if (secondClick) {
			$(thisradio).prop("checked", false);
			dataChange(thisradio, true);
		}
		secondClick = true;
	});
}

/**
*
*	This function checks the two stations that don't have TCMax
*	Special case requested by BNSF - Havelock and Topeka stations
*
**/
function validateStation(selector){
	var station_text = $("#station_select option:selected").text();
	var elems = document.querySelectorAll('[id^="gap_button_"]');
	
	if(station_text == 'Havelock' || station_text == 'Topeka'){
		//Need to attach onchange listener for these two stations. They do not have TCMax Data
		$("input.numspinner").off('change').change(function(){dataChange(this);}); 
		$("input.numspinner").attr("disabled",false);
		for (var i = 0; i < elems.length; i++) {
			elems[i].disabled = true;
		}
		
	}else{
		//Need to detach onchange listener if not Havelock or Topeka
		$("input.numspinner").off('change');
		$("input.numspinner").attr("disabled",true);
		for (var i = 0; i < elems.length; i++) {
			elems[i].disabled = false;
		}
	}
	
}

/**
*
*	This function determines if the assessment date is before 1/1/2021. If so, no gap inputs are available, so we block the button
*
**/
function checkCIQEpoch(){

	var elems = document.querySelectorAll('[id^="gap_button_"]');
	if(getJSDate(getAssessmentDate()) < getJSDate('2021-01-01')){
		for (var i = 0; i < elems.length; i++) {
			elems[i].disabled = true;
		}
	}else{
		for (var i = 0; i < elems.length; i++) {
			elems[i].disabled = false;
		}
	}
	
}

/**
*
*	Load the TCMax data entry dialog for a selected station. Might be able to narrow this down in the future if TCMax can tie items to questions type (gage, fall, etc..)
*
**/
function loadTCMaxForm(key){
	
	if(!isFormComplete()){

		setStatusMessage('Assessor, Assessment Date, CMO, Division, and Station must be selected before opening GAP Assessment Form', 'warning');

	}else{

		var selectedStation = getStation();
		$("#gapGageOne").empty();
		if(key == 'car_gage_1'){
			$("#gapGageOne").append('<b><i>Rule 1 gages require 21 unique assets</i></b>');
		}
		
		params_query={'query': 'select distinct SerialNumber, itemId from ' + ciq_lib + '.' + tc_max_data + ' WHERE ShopCode=\'' + selectedStation + '\' order by SerialNumber, itemId'};
		let payload = {
			action: 'fedSql.execDirect',
			data  : params_query
		}
		store.runAction(currentSession, payload).then ( r => {
			var tc_max_result = r.items('results', 'Result Set').toJS().rows;
			
			cleanupSelector('serial_select');
			cleanupSelector('nsn_select');
			$('#tcmax_tracking').empty();
			$('#due_date').empty();
			$('#storage_location').empty();
			$('#asset_description').empty();
			$("#assessment_comments").val('');
			
			$('#serial_select').append('<option value="MISSING">Missing Serial</option>');
			$('#nsn_select').append('<option value="MISSING">Missing NSN</option>');
			
			for(var i=0; i < tc_max_result.length; i++) {

				var serialNumber = tc_max_result[i][0];
				var nsNumber = tc_max_result[i][1];
				
				if(serialNumber.toString().trim() != '')
					$('#serial_select').append('<option value="' + tc_max_result[i][0] + '">' + tc_max_result[i][0] + '</option>');
				
				if(nsNumber.toString().trim() != '')
					$('#nsn_select').append('<option value="' + tc_max_result[i][1] + '">' + tc_max_result[i][1] + '</option>');
				
				
			}
			gapReadyToSubmit(false);
			
		}).catch(err => handleError(err))

		$('#gap_question_key').val(key);
		generateGapTable(key);
		$('#tcMaxForm').modal('show');
		
	}

}


/**
*
*	Load details for a selected serial number
*
**/
function loadSerialNumber(serialNumber){

	//If missing is selected, TCMax does not contain the asset
	if(serialNumber == '' || serialNumber == 'MISSING')
		return;

	$("#gapAssessmentError").empty();
	
	params_query={'query': 'select distinct barcodeid, put(cast(duedate as date), yymmdd10.), storageLocation, name from ' + ciq_lib + '.' + tc_max_data + ' WHERE SerialNumber=\'' + serialNumber + '\' and ShopCode=\'' + getStation() + '\''};
	let payload = {
		action: 'fedSql.execDirect',
		data  : params_query
	}
	store.runAction(currentSession, payload).then ( r => {
		
		if(r.items('results', 'Result Set').toJS().rows.length == 1){
			$("#nsn_select").prop('selectedIndex',0);
			loadAssetDetail(r.items('results', 'Result Set').toJS().rows[0]);
		}else{
			gapAssessmentDuplicates(r.items('results', 'Result Set').toJS().rows);
		}

	}).catch(err => handleError(err))	

}

/**
*
*	Load details for a selected NSN number
*
**/
function loadNSNumber(nsnNumber){
	
	//If missing is selected, TCMax does not contain the asset
	if(nsnNumber == '' || nsnNumber == 'MISSING')
		return;
	
	$("#gapAssessmentError").empty();
	
	params_query={'query': 'select distinct barcodeid, put(cast(duedate as date), yymmdd10.), storageLocation, name from ' + ciq_lib + '.' + tc_max_data + ' WHERE itemId=\'' + nsnNumber + '\' and ShopCode=\'' + getStation() + '\''};
	let payload = {
		action: 'fedSql.execDirect',
		data  : params_query
	}
	store.runAction(currentSession, payload).then ( r => {
		
		if(r.items('results', 'Result Set').toJS().rows.length == 1){
			$("#serial_select").prop('selectedIndex',0);
			loadAssetDetail(r.items('results', 'Result Set').toJS().rows[0]);
		}else{
			gapAssessmentDuplicates(r.items('results', 'Result Set').toJS().rows);
		}

	}).catch(err => handleError(err))	

}

/**
*
*	Display message if TCMax contains duplicates by shopcode or NSN/Serial
*
**/
function gapAssessmentDuplicates(rows){

	$("#gapAssessmentError").empty();
	var error = '<div class="alert alert-danger alert-dismissible col-sm-12" role="alert"><a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>';
	error += 'The following assets are duplicated';
	error += '<ul>';
	for(var i=0; i < rows.length; i++){
		error += '<li>Barcode: ' + rows[i][0] + '</li>';
	}
	error += '</ul>';
	error += '</div>';
	$("#gapAssessmentError").append(error);

}

/**
*
*	Load the GAP asset
*
**/
function loadAssetDetail(assetDetail){

	$('#tcmax_tracking').empty().append(assetDetail[0]);
	$('#due_date').empty().append(assetDetail[1]);
	setGapAssetDate(assetDetail[1]);
	setGapInDate(assetDetail[1]);
	$('#storage_location').empty().append(assetDetail[2]);
	$('#asset_description').empty().append(assetDetail[3]);
	$('#certification_select').prop('selectedIndex',0);
	gapReadyToSubmit(true);
	
}

/**
*
*	Determine if the asset is within date and automatically set in-date select
*
**/
function setGapInDate(){
	
	var formDate = getJSDate($('#form_date').val());
	var dueDate = getJSDate($('#due_date').text());
	var pickerDate = getJSDate($('#asset_date').val());
	
	if(formDate.getTime() < pickerDate.getTime())
		$("#in_date_select").prop('selectedIndex',0);
	else
		$("#in_date_select").prop('selectedIndex',1);
	
}

/**
*
*	Set the GAP asset 
*
**/
function setGapAssetDate(date){
	document.querySelector("#asset_date").valueAsDate = getJSDate(date);
}


/**
*
*	Called when the Apply button is pressed on the GAP entry form (modal dialog)
*
**/
function applyGapValues(){
	
	if($('#certification_select').val() != ''){
			
		var gapAssessment = new Gap(getFormKey(), 
									$('#gap_question_key').val(), 
									$('#assessment_comments').val().replace(/\"/g, ""), //Remove any double quotes
									$('#asset_description').text(), 
									$('#due_date').text(), 
									$('#certification_select').val(),
									$('#in_date_select').val(), 
									$('#storage_location').text(), 
									$('#serial_select').val(), 
									$('#nsn_select').val(), 
									$('#tcmax_tracking').text(), 
									$('#asset_date').val());
									
		
		saveGapAssessment(gapAssessment);
		resetTCMaxForm();
	}else{
		$('#certification_select').focus();
	}
	
}

/**
*
*	An asset has either been added or updated. Determine and make the appropriate call.
*
**/
function saveGapAssessment(gapAssessment){
	
	//Determine if the tracking ID already exists for this assessment/station. If so we update else insert
	params_query={'query': 'select form_key, question_key, comment, description, put(due_date, yymmdd10.), in_cert, in_date, location, serial, nsn, tracking_id, put(asset_date, yymmdd10.)  from ' + ciq_lib + '.' + ciq_gap_inputs + ' where form_key=\'' + gapAssessment.form_key + '\' and question_key=\'' + gapAssessment.question_key + '\' and tracking_id=\'' + gapAssessment.tracking_id + '\''};
	let payload = {
		action: 'fedSql.execDirect',
		data  : params_query
	}
	store.runAction(currentSession, payload).then ( r => {
		gap_count = r.items('results', 'Result Set').toJS().rows.length;
		if(gap_count == 0)
			insertGapAssessment(gapAssessment);
		else
			updateGapAssessment(gapAssessment);
		
	}).catch(err => handleError(err))
	
}

/**
*
*	Update a single GAP record into the dataset
*
**/
function updateGapAssessment(gapAssessment){

	var filter ='form_key="' + gapAssessment.form_key + '" AND question_key="' + gapAssessment.question_key + '" AND tracking_id="' + gapAssessment.tracking_id + '"';
	var set = [];
	set.push({'var':'comment', 'value':'\'' + gapAssessment.comment + '\''});	
	set.push({'var':'in_cert', 'value':'\'' + gapAssessment.in_cert + '\''});
	set.push({'var':'in_date', 'value':'\'' + gapAssessment.in_date + '\''});
	set.push({'var':'asset_date', 'value':'' + getSASDays(gapAssessment.asset_date) + ''});	
	
	update_gap_data={'table': { 'name': ciq_gap_inputs, 'caslib': ciq_lib, 'where': filter}, set};
		
	let payload = {
		action: 'table.update',
		data  : update_gap_data
	}

	store.runAction(currentSession, payload).then ( r => {
		generateGapTable(gapAssessment.question_key);
	}).catch(err => handleError(err))

}

/**
*
*	Inserts a single GAP record into the dataset
*
**/
function insertGapAssessment(gapAssessment){
	
	var code = 'data ' + ciq_lib + '.' + ciq_gap_inputs + '(append=yes);';
	code += 'length form_key varchar(55);';
	code += 'length question_key varchar(18);';
	code += 'length comment description varchar(255);';
	code += 'length due_date 8;';
	code += 'length in_cert in_date location serial nsn tracking_id varchar(50);';
	code += 'length asset_date 8;';
	code += 'form_key="' + gapAssessment.form_key + '";';
	code += 'comment="' + gapAssessment.comment + '";';
	code += 'question_key="' + gapAssessment.question_key + '";';
	
	var gapDescription = gapAssessment.description;
	gapDescription = gapDescription.replace(/[&"{}]/g, '');//Escape special characters that will trip up SAS
	code += 'description="' + gapDescription + '";'; 
	
	code += 'due_date=input("' + gapAssessment.due_date + '", yymmdd10.);'; 
	code += 'in_cert="' + gapAssessment.in_cert + '";';
	code += 'in_date="' + gapAssessment.in_date + '";';
	code += 'location="' + gapAssessment.location + '";';
	code += 'serial="' + gapAssessment.serial + '";';
	code += 'nsn="' + gapAssessment.nsn + '";';
		
	if(gapAssessment.serial == 'MISSING' || gapAssessment.nsn == 'MISSING')
		code += 'tracking_id="MISSING_' + generateId(5) + '";';
	else
		code += 'tracking_id="' + gapAssessment.tracking_id + '";';
	
	code += 'asset_date=input("' + gapAssessment.asset_date + '", yymmdd10.);';
	code += 'run;';
				
	let payload = {
		action: 'datastep.runCode',
		data  : {'code': code, 'single': 'yes'}
	}


	store.runAction(currentSession, payload).then ( r => {
		generateGapTable(gapAssessment.question_key);
	}).catch(err => handleError(err))
	
}

/**
*
*	Deletes a GAP entry of the dataset and redraws the table
*
**/
function removeGapValue(question_key, trackingId){
	
	var filter ='form_key="' + getFormKey() + '" and question_key="' + question_key + '" and tracking_id="' + trackingId + '"';
	delete_rows={'table': { 'name': ciq_gap_inputs, 'caslib': ciq_lib, 'where': filter}};
	let deletePayload = {
		action: 'table.deleteRows',
		data  : delete_rows
	}
	
	store.runAction(currentSession, deletePayload).then ( r => {
		generateGapTable(question_key);
	}).catch(err => handleError(err))

}

/**
*
*	Load a gap asset and populate the form for viewing/editing
*
**/
function loadGapValue(question_key, trackingId){

	params_query={'query': 'select form_key, question_key, comment, description, put(due_date, yymmdd10.), in_cert, in_date, location, serial, nsn, tracking_id, put(asset_date, yymmdd10.)  from ' + ciq_lib + '.' + ciq_gap_inputs + ' where form_key=\'' + getFormKey() + '\' and question_key=\'' + question_key + '\' and tracking_id=\'' + trackingId + '\''};
	let payload = {
		action: 'fedSql.execDirect',
		data  : params_query
	}
	store.runAction(currentSession, payload).then ( r => {
		gap_entry = r.items('results', 'Result Set').toJS().rows;
		var editGap = new Gap(gap_entry[0][0], 
							  gap_entry[0][1],
						      gap_entry[0][2],
						      gap_entry[0][3],
						      gap_entry[0][4],
						      gap_entry[0][5],
						      gap_entry[0][6],
						      gap_entry[0][7],
						      gap_entry[0][8],
						      gap_entry[0][9],
						      gap_entry[0][10],
						      gap_entry[0][11]);
							  
		loadGapFormValues(editGap);

	}).catch(err => handleError(err))
	
}

/**
*
*	This function loads a stored GAP entry to the UI
*
**/
function loadGapFormValues(gap){
	
	if(gap.serial == '')
		$("#serial_select").prop('selectedIndex',0);
	else
		$("#serial_select").val(gap.serial);

	if(gap.nsn == '')
		$("#nsn_select").prop('selectedIndex',0);
	else
		$("#nsn_select").val(gap.nsn);
	
	if(gap.asset_date != '' && gap.asset_date != '.')
		setGapAssetDate(gap.asset_date);
	else
		$("#asset_date").val('');
	
	$("#in_date_select").val(gap.in_date);
	$("#certification_select").val(gap.in_cert);
	
	$("#assessment_comments").val(gap.comment);
	$('#tcmax_tracking').empty().append(gap.tracking_id);	
	$('#due_date').empty().append(gap.due_date);
	$('#storage_location').empty().append(gap.location);
	$('#asset_description').empty().append(gap.description);
	gapReadyToSubmit(true);
	
}

/**
*
*	Reset the GAP form
*
**/
function resetTCMaxForm(){
	
	$("#serial_select").prop('selectedIndex',0);
	$("#nsn_select").prop('selectedIndex',0);
	$("#in_date_select").prop('selectedIndex',0);
	$("#certification_select").prop('selectedIndex',0);
	$("#asset_date").val('');
	$("#assessment_comments").val('');
	$('#tcmax_tracking').empty();
	$('#due_date').empty();
	$('#storage_location').empty();
	$('#asset_description').empty();
	gapReadyToSubmit(false);
	
}

/**
*
*	Toggles the Apply Gap button. Without this it would be possible to apply all blank values
*
**/
function gapReadyToSubmit(isready){

	if(isready){
		
		$('#applyGapButton').prop('disabled', false);
		
	}else{
		
		$('#applyGapButton').prop('disabled', true);
		
	}
	
}

/**
*
*	This code fetches the GAP assets for a specific form and question
*	The HTML table is drawn and the assessment calculations for (sample, eqp_ood, etc..) are validated and updated if necessary
*
**/
function generateGapTable(question_key){
	
	params_query={'query': 'select form_key, question_key, comment, description, put(due_date, yymmdd10.), in_cert, in_date, location, serial, nsn, tracking_id, put(asset_date, yymmdd10.)  from ' + ciq_lib + '.' + ciq_gap_inputs + ' where form_key=\'' + getFormKey() + '\' and question_key=\'' + question_key + '\' ORDER BY tracking_id asc'};
	let payload = {
		action: 'fedSql.execDirect',
		data  : params_query
	}
		
	var gapValues = [];
	store.runAction(currentSession, payload).then ( r => {
		gap_entries = r.items('results', 'Result Set').toJS().rows;
		for(var i=0; i < gap_entries.length; i++){
			gapValues.push(new Gap(gap_entries[i][0], 
								   gap_entries[i][1],
								   gap_entries[i][2],
								   gap_entries[i][3],
								   gap_entries[i][4],
								   gap_entries[i][5],
								   gap_entries[i][6],
								   gap_entries[i][7],
								   gap_entries[i][8],
								   gap_entries[i][9],
								   gap_entries[i][10],
								   gap_entries[i][11]));
		}

		$('#gap_table').empty();
		
		var tableHtml = '<thead><th scope="col">#</th><th scope="col">Serial</th><th scope="col">NSN</th><th scope="col">Barcode</th><th scope="col">Date</th><th scope="col">Due Date</th><th scope="col">In Date</th><th scope="col">Cert?</th><th></th></tr></thead>';
		tableHtml += '<tbody>';
		var rowNum = 1;
		for(var i=0; i < gapValues.length; i++){
			tableHtml += '<tr>';
			tableHtml += '<th scope="row">' + rowNum + '</th>';
			tableHtml += '<td>' + gapValues[i].serial + '</td>';
			tableHtml += '<td>' + gapValues[i].nsn + '</td>';
			tableHtml += '<td>' + gapValues[i].tracking_id + '</td>';
			tableHtml += '<td>' + gapValues[i].asset_date + '</td>';
			tableHtml += '<td>' + gapValues[i].due_date + '</td>';
			tableHtml += '<td>' + gapValues[i].in_date + '</td>';
			tableHtml += '<td>' + gapValues[i].in_cert + '</td>';
			tableHtml += '<td>';
			tableHtml += '<a href="javascript:loadGapValue(\'' + gapValues[i].question_key + '\', \'' + gapValues[i].tracking_id + '\');"><img src="images/edit.png"></a>&nbsp;&nbsp;';
			tableHtml += '<a href="javascript:removeGapValue(\'' + gapValues[i].question_key + '\', \'' + gapValues[i].tracking_id + '\');"><img src="images/delete.png"></a>';
			tableHtml += '</td>';
			tableHtml += '</tr>';
			rowNum++;
		}
		tableHtml += '</tbody>';
		
		$('#gap_table').append(tableHtml);
		calculateGapValues(gapValues, question_key);

	}).catch(err => handleError(err))

}

/**
*
*	Calculate exceptions based on entered GAP items. If this number varies from the overall question count it will be updated
*	This is based off of the logic provided by BNSF (step 1) and could need to be changed in the future
*
**/
function calculateGapValues(gap_entries, question_key){

	//1) Determine the sample, eqp_ood, track_ood, missing_cert, exceptions
	var sampleSize = gap_entries.length;
	var equipmentOOD = 0;
	var trackerOOD = 0;
	var certMissing = 0;
	var exceptions = 0;
		
	/* This logic performs the calculations of sample, ood's missing certs, and total exceptions */	
	for(var i=0; i < gap_entries.length; i++){
		var gap = gap_entries[i];
		
		//Calculate certification missing
		if(gap.in_cert == 'No'){
			certMissing++;
			exceptions++;
		}

		//Calculate if eqp in date
		if(gap.in_date == 'No'){
			equipmentOOD++;
			exceptions++;
		}
			
		//If serial or NSN missing increment tracker OOD	
		if(gap.serial == 'MISSING' || gap.nsn == 'MISSING'){
			trackerOOD++;
			exceptions++;
		}
		
		//If due date and asset date do not match increment tracker OOD
		if(getJSDate(gap.due_date).getTime() !== getJSDate(gap.asset_date).getTime()){
			trackerOOD++;
			exceptions++;			
		}
		
	}
	
	//2) Compare them to the assessment values
	if($('#' + question_key + '_sample').val() != sampleSize || 
	   $('#' + question_key + '_equipment_ood').val() != equipmentOOD ||
	   $('#' + question_key + '_tracker_ood').val() != trackerOOD ||
	   $('#' + question_key + '_cert_missing').val() != certMissing ||
	   $('#' + question_key + '_exceptions').val() != exceptions){
		   

		//3) If different perform an insert/update
		$('#' + question_key + '_sample').val(sampleSize);
		$('#' + question_key + '_equipment_ood').val(equipmentOOD);
		$('#' + question_key + '_tracker_ood').val(trackerOOD);
		$('#' + question_key + '_cert_missing').val(certMissing);
		$('#' + question_key + '_exceptions').val(exceptions);
		
		processAssessmentData(new Assessment(getFormKey(), 
										     getFormType(), 
											 getAssessmentType(), 
											 getCMO(), 
											 getDivision(), 
											 getStation(), 
											 getAssessor(), 
											 getAssessmentDate(), 
											 sampleSize, 
											 equipmentOOD, 
											 trackerOOD, 
											 certMissing, 
											 exceptions, 
											 null, null, null, null, null, null, 
											 question_key, 
											 null));	

	}
	

}

/**
*
*	Determine if a pending assessment can be approved
*
**/
function isReadyForApproval(){

	if(isFormComplete() && getAssessmentStatus() == 'pending'){
		
		$('#approval_button').prop('disabled', false);
		
	}else{
		
		$('#approval_button').prop('disabled', true);
		
	}

}

/**
*
*	Approve an assessment. Will validate all rules are met and then display the confirmation dialog
*
**/
async function approveAssessment(){
	if(await validateAssessment())
		displayAssessmentConfirmDialog();
}

/**
*
*	This code determines if an assessment is ready to be approved. Several rules currently
*	1) Validate that at least one row of data has been entered for the assessment
*	2) Make sure all Gap assets have a yes/no for certifications available
*	3) Enforce a selection of 21 assets for Rule-1 Gages
*	4) Display confirmation dialog and require name and date to be entered
*
**/
async function validateAssessment(){
		
	//1) Make sure the form has data
	if(await doesFormContainData()){
		
		//2) Make sure all of the certificates are Yes or No. No pending values. If we have pendings, show where they are
		pendingGaps = await getPendingCertifications();
		if(pendingGaps.length == 0){
			
			//If form type is Loco, no need to worry about Rule 1 Gages
			if(getFormType() == 'Loco'){
				
				return true;
				
			}else{
				
				//3) Rule 1 Gages requirement
				gageOneCount = await getGageOneCount();
				if(gageOneCount !== rule_one_gage_min){
					displayRuleGageErrorDialog(gageOneCount);
					return false;
				}else{
					return true;
				}
				
			}
	
		}else{
			
			displayPendingCertsDialog(pendingGaps);
			return false;
			
		}
		
	}else{
		
		displayNoAssessmentDataDialog();
		return false;
		
	}

}

/**
*
*	Determine if the assessment form has data entered
*
**/
async function doesFormContainData(){
	
	count_query={'query': 'select count(*) from ' + ciq_lib + '.' + ciq_results + ' WHERE form_key=\'' + getFormKey() + '\' AND assessment_approved=0'};
	let payload = {
		action: 'fedSql.execDirect',
		data  : count_query
	}
	
	let records = await store.runAction(currentSession, payload);
	if(records.items('results', 'Result Set').toJS().rows[0][0] > 0)
		return true;
	else
		return false;

}

/**
*
*	Determine if all certificates have been accounted for. Should all be yes/no. No pendings.
*
**/
async function getPendingCertifications(){

	cert_query={'query': 'select question_key, in_cert, serial, nsn, tracking_id from ' + ciq_lib + '.' + ciq_gap_inputs + ' where form_key=\'' + getFormKey() + '\' and in_cert=\'Pending\''};
	let payload = {
		action: 'fedSql.execDirect',
		data  : cert_query
	}
	
	let records = await store.runAction(currentSession, payload);
	return records.items('results', 'Result Set').toJS().rows;

}

/**
*
*	Determine current Gage One counts
*
**/
async function getGageOneCount(){

	gage_one_query={'query': 'select count(*) from ' + ciq_lib + '.' + ciq_gap_inputs + ' WHERE form_key=\'' + getFormKey() + '\' AND question_key=\'car_gage_1\''};
	let payload = {
		action: 'fedSql.execDirect',
		data  : gage_one_query
	}
	
	let records = await store.runAction(currentSession, payload);
	return records.items('results', 'Result Set').toJS().rows[0][0];
}

/**
*
*	Assessment form is ready to be submitted
*
**/
function displayAssessmentConfirmDialog(){
	
	$('#approveAssessmentButton').prop('disabled', false);
	$("#approveAssessmentButton").removeClass("btn-secondary btn-primary").addClass("btn-primary");
	$('#approveAssessmentHeader').empty().append('Confirm Assessment Approval');
	
	var html = '<div class="alert alert-warning">Please confirm the assessment approval by entering your name and todays date below</div>';
	
	html += '<div class="form-row">';
	html += '<div class="col-md-6"><label for="approved_by">Approved By</label><input readonly type="text" maxlength="50" class="form-control" id="approved_by" name="approved_by" value="' + ciq_user +'"/></div>';
	html += '<div class="col-md-6"><label for="date_approved">Approved Date</label><input required type="date" class="form-control" id="date_approved" name="date_approved"></div>';
	html += '</div>';
	
	$('#approveAssessmentBody').empty().append(html);
	$('#approve_assessment_modal').modal('show');
	
}

/**
*
*	The assessment form has met all the conditions and is submitted
*
**/
$("#approveAssessmentForm").submit(function( event ) {
	
	event.preventDefault();

	var filter ='form_key="' + getFormKey() + '"';
	var set = [];
	set.push({'var':'assessment_approved', 'value':'1'});
	set.push({'var':'date_approved', 'value':'' + getSASDays($("#date_approved").val()) + ''});
	set.push({'var':'approved_by', 'value':JSON.stringify($("#approved_by").val())});	
	
	approve_assessment={'table': { 'name': ciq_results, 'caslib': ciq_lib, 'where': filter}, set};
	
	let payload = {
		action: 'table.update',
		data  : approve_assessment
	}
	
	store.runAction(currentSession, payload).then ( r => {
		loadAssessment();
		setStatusMessage('The CIQ assessment was successfully approved. Change the Assessment Status seletion to view approved assessments.', 'success');
		$('#approve_assessment_modal').modal('hide');
	}).catch(err => handleError(err))	


});

/**
*
*	Dialog: We have some certifications that have pending certs
*
**/
function displayPendingCertsDialog(pendingGaps){
	
	$('#approveAssessmentButton').prop('disabled', true);
	$("#approveAssessmentButton").removeClass("btn-secondary btn-primary").addClass("btn-secondary");
	$('#approveAssessmentHeader').empty().append('Pending Cert Verification');
			
	var tableHtml = '<div class="alert alert-warning">The following certifications still have a pending status</div>'; 
	tableHtml += '<table class="table table-sm">';
	tableHtml += '<thead><tr><th scope="col">Question Key</th><th scope="col">Cert Status</th><th scope="col">Serial</th><th scope="col">NSN</th><th scope="col">Barcode</th></tr></thead>';
	tableHtml += '<tbody>';
	for(var i=0; i < pendingGaps.length; i++){
		tableHtml += '<tr>';
		tableHtml += '<th scope="row">' + pendingGaps[i][0] + '</th>';
		tableHtml += '<td>' + pendingGaps[i][1] + '</td>';
		tableHtml += '<td>' + pendingGaps[i][2] + '</td>';
		tableHtml += '<td>' + pendingGaps[i][3] + '</td>';
		tableHtml += '<td>' + pendingGaps[i][4] + '</td>';
		tableHtml += '</tr>';
	}
	tableHtml += '</tbody>';
	tableHtml += '</table>';
		
	$('#approveAssessmentBody').empty().append(tableHtml);
	$('#approve_assessment_modal').modal('show');
	
}

/**
*
*	Dialog: Gage Rule 21 rule not followed
*
**/
function displayRuleGageErrorDialog(currentCount){
	
	$('#approveAssessmentButton').prop('disabled', true);
	$("#approveAssessmentButton").removeClass("btn-secondary btn-primary").addClass("btn-secondary");
	$('#approveAssessmentHeader').empty().append('Rule 1 Gages');
	$('#approveAssessmentBody').empty().append('<div class="alert alert-danger">Rule 1 Gages require ' + rule_one_gage_min + ' unique assets. ' + currentCount + ' have been entered.</div>');
	$('#approve_assessment_modal').modal('show');
	
}

/**
*
*	Dialog: No assessment data to approve
*
**/
function displayNoAssessmentDataDialog(){
	
	$('#approveAssessmentButton').prop('disabled', true);
	$("#approveAssessmentButton").removeClass("btn-secondary btn-primary").addClass("btn-secondary");
	$('#approveAssessmentHeader').empty().append('Assessment Data Missing');
	$('#approveAssessmentBody').empty().append('<div class="alert alert-warning">No data has been entered for this assessment.</div>');
	$('#approve_assessment_modal').modal('show');
	
}

/**
*
*	Get the selected assessment status pending/approved
*
**/
function getAssessmentStatus(){
	
	return $('#assessment_status').val();

}

/**
*
*	Generate the unique form key based off of type, assessor, date, CMO, Division, and Station
*
**/
function getFormKey(){
	
	var form_key = getFormType() + '_' + getAssessmentType() + '_' + getCMO() + '_' + getDivision() + '_' + getStation() + '_' +  getAssessmentDate();
	return form_key.replaceAll("-", "_").toUpperCase();
}

/**
*
*	Get the form type
*
**/
function getFormType(){
	return $('#form_type').val();
}

/**
*
*	Get the assessment type
*
**/
function getAssessmentType(){
	return $('#assessment_type').val();
}

/**
*
*	Get the CMO selection
*
**/
function getCMO(){
	return $('#cmo_select').val();
}

/**
*
*	Get the division selection
*
**/
function getDivision(){
	return $('#division_select').val();
}

/**
*
*	Get the station selection
*
**/
function getStation(){
	return $('#station_select').val();
}

/**
*
*	Get the assessor
*
**/
function getAssessor(){
	return $('#assessor').val();
}

/**
*
*	Get the assessment date
*
**/
function getAssessmentDate(){
	return $('#form_date').val();
}

/**
*
*	Assessment object - matches the dataset structure for approved and pending assessments
*
**/
function Assessment(form_key, form_type, assessment_type, cmo_select, division_select, station_select, assessor, form_date, sample, eqp_ood, tracker_ood, cert_missing,
					exceptions, compliance, opportunity, findings, corrective_action, champion, timeframe, question_key, lod_question_calc){
						
	this.form_key = form_key;	
	this.form_type = form_type;
	this.assessment_type = assessment_type;
	this.cmo_select = cmo_select;
	this.division_select = division_select;
	this.station_select = station_select;
	this.assessor = assessor;
	this.form_date = form_date;
	this.sample = sample;
	this.eqp_ood = eqp_ood;
	this.tracker_ood = tracker_ood;
	this.cert_missing = cert_missing;
	this.exceptions = exceptions;
	this.compliance = compliance;
	this.opportunity = opportunity;
	this.findings = findings;
	this.corrective_action = corrective_action;
	this.champion = champion;
	this.timeframe = timeframe;
	this.question_key = question_key;	
	this.lod_question_calc = lod_question_calc;
	
}

/**
*
*	Gap object - matches the dataset structure for gap_inputs
*
**/
function Gap(form_key, question_key, comment, description, due_date, in_cert, in_date, location, serial, nsn, tracking_id, asset_date){
	this.form_key = form_key;
	this.question_key = question_key;
	this.comment = comment;
	this.description = description;
	this.due_date = due_date;
	this.in_cert = in_cert;
	this.in_date = in_date;
	this.location = location;
	this.serial = serial;
	this.nsn = nsn;
	this.tracking_id = tracking_id;
	this.asset_date = asset_date;
}

/**
*
*	Utility to get the questions for a topic
*
**/
function getTopicQuestions(topic){

	var questions = [];

	for(var i=0; i < form_questions.length; i++) {
		if(form_questions[i][2] == topic)
			questions.push(form_questions[i]);
	}

	return questions;

}

/**
*
*	Utility to get the distinct topics for an assessment form
*
**/
function loadDistinctTopics(){

	form_topics = [];

	for(var i=0; i < form_questions.length; i++) {
		var topic = form_questions[i][2];
		if(!form_topics.includes(topic))
			form_topics.push(topic);
	}

}

/**
*
*	Take a string date and converts it to an actual JavaScript date form: mm-dd-yyyy
*
**/
function getJSDate(dateString){
	
	var dateParts = dateString.split("-");
	return new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
}

/**
*
*	Generate a unique id
*
**/
function generateId(size){
	
    var characters = '23456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var id_length = size;
    var rtn = '';
    for (var i = 0; i < id_length; i++) {
      rtn += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return rtn;
	
}

/**
*
*	Set status messages (warning, success, danger)
*
**/
function setStatusMessage(message, type){

	clearStatusMessage();
	$("#status_message").append('<div class="alert alert-' + type + ' alert-dismissible col-sm-12" role="alert"><a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>' + message + '</div>');	

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
*	Global function to handle any errors tha occur
*
**/
function handleError(err){

	clearStatusMessage();
	$("#status_message").append('<div class="alert alert-danger alert-dismissible col-sm-12" role="alert"><a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>An error has occured: ' + err + '</div>');
	console.log('CIQ Assessment Form Error: ' + err);

}

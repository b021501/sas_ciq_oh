cas;
caslib _all_ assign;

/* Excel file is imported into PUBLIC */
/* proc contents data=public.bnsf_tb_data varnum; */
/* run; */

/* Snapshot of the initial data */
/* proc print data=public.bnsf_tb_data(obs=10); */
/* run; */

/* Map the ingested column names to the names used in the data entry form */
data public.tb_data_temp;

	length form_type varchar(4); 
	length assessment_type cmo_select division_select station_select assessor varchar(50);
	length form_date timeframe 8;
	length sample eqp_ood tracker_ood cert_missing exceptions compliance opportunity 8;
	length findings corrective_action champion varchar(255);

	set bnsf.bnsf_tb_final(rename=(
						   'Assessment Type'n = assessment_type
						   name = assessor
						   'Cert Miss'n = cert_missing
						   region = cmo_select
						   corrective = corrective_action
						   superintendent = division_select
						   'Equip OOD'n = eqp_ood
						   'Assessment Date'n = form_date
						   'Car/Loco'n = form_type
						   location = station_select
						   'Target Date'n = timeframe
						   'Tracker OOD'n = tracker_ood
						   'Question Number'n = question_number
						   ));
run;

/* Overwrite the division and station values with their codes. 
   Excel file station_mappings.xls 
   Will be recoded in VA (or elsewhere).
   New form key 
*/
data public.tb_data_etl;

	length division_select varchar(3) station_select varchar(12) form_key varchar(55);
	merge public.tb_data_temp(rename=(division_select=div_temp station_select=station_temp) drop="Form Key"n) 
		  public.station_mappings(rename=(division_select=div_temp station_select=station_temp));
	by div_temp station_temp;
	division_select=div_code;
	station_select=station_code;

	form_key = upcase(catx("_", form_type, assessment_type, cmo_select, division_select, station_select, put(form_date, DATE9.)));

	if assessment_type = "CIQ Manager" then assessment_type = "CIQ";
	assessment_type = upcase(assessment_type);

	if sample = . and lod_question_calc = 1 then do;
		compliance = 1;
		opportunity = 0;
	end;
	else if sample = . and lod_question_calc = 0 then do;
		compliance = 0;
		opportunity = 1;
	end;

	drop div_temp station_temp div_code station_code "Total Possible Exceptions"n lod_question_calc;

run;

/* Determine the question key for each row */
data public.tb_data_etl;
	merge public.tb_data_etl bnsf.question_key ;
	by form_type category question_number;
	drop question_number question question_active question_type required category;
run;

/* Order the columns and promote the final table */
data bnsf.CIQ_DATA_ENTRY_RESULTS(promote=yes);
	retain form_key form_type assessment_type cmo_select division_select station_select assessor form_date sample eqp_ood 
		   tracker_ood cert_missing exceptions compliance opportunity findings corrective_action champion timeframe;
	length question_key varchar(18);
	set public.tb_data_etl(rename=(question_key=qkey));
	question_key = qkey;
	drop qkey;
run;

proc casutil; 
	save casout="CIQ_DATA_ENTRY_RESULTS" casdata="CIQ_DATA_ENTRY_RESULTS" incaslib="BNSF" outcaslib="BNSF" replace;
quit;


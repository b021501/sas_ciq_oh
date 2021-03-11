cas;
caslib _all_ assign;

data bnsf.CIQ_DATA_ENTRY_RESULTS_PENDING(promote=yes);

	length form_key varchar(55);
	length form_type varchar(4); 
	length assessment_type cmo_select varchar(50);
	length division_select varchar(3) station_select varchar(12);
	length assessor varchar(50);
	length form_date 8;
	length sample eqp_ood tracker_ood cert_missing exceptions compliance opportunity 8;
	length findings corrective_action champion varchar(255);
	length timeframe 8;
	length question_key varchar(18);
	length LOD_Question_Calc 8;

	format form_date mmddyy10. sample best9. tracker_ood best14. cert_missing best11. timeframe mmddyy10. 'LOD Question Calc'n PERCENT12.2;
	stop;

run;

proc casutil; 
	save casout="CIQ_DATA_ENTRY_RESULTS_PENDING" casdata="CIQ_DATA_ENTRY_RESULTS_PENDING" incaslib="BNSF" outcaslib="BNSF" replace;
quit;

data bnsf.ciq_gap_inputs(promote=yes);

	length form_key varchar(55);
	length question_key varchar(18);
	length comment description varchar(255); 
	length due_date in_cert in_date location serial nsn tracking_id varchar(50);
	
	label
		comment="Entered Comments"
		description = "Description"
		due_date = "Due Date"
		in_cert = "Certification?"
		in_date = "In Date?"
		location = "Location"
		serial = "Serial Number"
		tracking_id = "Tracking ID"
		nsn = "National Stock Number"
	;

	stop;

run;

proc casutil; 
	save casout="ciq_gap_inputs" casdata="ciq_gap_inputs" incaslib="BNSF" outcaslib="BNSF" replace;
quit;
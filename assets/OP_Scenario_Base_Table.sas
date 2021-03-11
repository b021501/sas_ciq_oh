cas;
caslib _all_ assign;

data bnsf.op_scenario(promote=yes);

	length 

		scenario_id 8
		scenario_name varchar(30)
		creation_date 8
		last_edited 8
		frozen 8
		created_by varchar(50)
		evo_years_target evo_mwh_target evo_mwh_avg_day 8
		dash9_years_target dash9_mwh_target dash9_mwh_avg_day 8
		emd_int_years_target emd_int_mwh_target emd_int_mwh_avg_day 8
		emd_hp_years_target emd_hp_mwh_target emd_hp_mwh_avg_day 8
		tier4_years_target tier4_mwh_target tier4_mwh_avg_day 8
		ac4400_years_target ac4400_mwh_target ac4400_mwh_avg_day 8
		b40_8_years_target b40_8_mwh_target b40_8_mwh_avg_day 8
		dash8_years_target dash8_mwh_target dash8_mwh_avg_day 8
		
	;

	label 
		scenario_name="Scenario Name"
		creation_date="Creation Date"
		last_edited="Last Edited Date"
		frozen = "Frozen"
		created_by = "Created By"
		evo_years_target="EVO Years Target"
		evo_mwh_target="EVO MWH Target"
		evo_mwh_avg_day="EVO Average MWH Per Day"
		dash9_years_target="Dash9 Years Target" 
		dash9_mwh_target="Dash9 MWH Target"
		dash9_mwh_avg_day="Dash9 Average MWH Per Day"
		emd_int_years_target="EMD Intermediate Years Target" 
		emd_int_mwh_target="EMD Intermediate MWH Target"
		emd_int_mwh_avg_day="EMD Intermediate Average MWH Per Day"
		emd_hp_years_target="EMD High HP Years Target" 
		emd_hp_mwh_target="EMD High HP MWH Target"
		emd_hp_mwh_avg_day="EMD High HP Average MWH Per Day"
		tier4_years_target="Tier4 Years Target"
		tier4_mwh_target="Tier4 MWH Target"
		tier4_mwh_avg_day="Tier4 Average MWH Per Day"
		ac4400_years_target="AC4400 Years Target"
		ac4400_mwh_target="AC4400 MWH Target"
		ac4400_mwh_avg_day="AC4400 Average MWH Per Day"
		b40_8_years_target="B40 8 Years Target"
		b40_8_mwh_target="B40 8 MWH Target"
		b40_8_mwh_avg_day="B40 8 Average MWH Per Day"
		dash8_years_target="Dash8 Years Target"
		dash8_mwh_target="Dash8 MWH Target"
		dash8_mwh_avg_day="Dash8 Average MWH Per Day"
	;

	format creation_date last_edited datetime.;

	stop;
run;

data bnsf.op_scenario_audit(promote=yes);

	length 
		scenario_id 8
		audit_date 8
		audit_label varchar(255)
		user varchar(50)
		property varchar(255)
		value varchar(255)
	;
	
	format audit_date datetime.;

run;

proc contents data=bnsf.op_scenario;
run;

proc contents data=bnsf.op_scenario_audit;
run;
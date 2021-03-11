/* 
#################################################
Delete rows from a CAS table based on a key value 
#################################################
*/
%macro deleteRows(caslib=BNSF, tablename=CIQ_DATA_ENTRY_RESULTS_PENDING, key_column=form_key, key_value=);

	proc cas;
	  table.deleteRows / table={caslib="&caslib", name="&tablename", where="%tslit(&key_value) = &key_column"};
	run;

%mend;
%deleteRows(key_value=CAR_QTR_NORTH_HLA_BIRMAL_2020_12_02);
 
/* 
############################################################
Update a CIQ column value based on form_key and question_key 
############################################################
*/
%macro updateCIQValue(caslib=BNSF, tablename=CIQ_DATA_ENTRY_RESULTS_PENDING, form_key=, question_key=, update_col=, update_val=);
	proc cas;
	  table.update / table={caslib="&caslib", 
						    name="&tablename", 
					        where="%tslit(&form_key) = form_key and %tslit(&question_key) = question_key"},
				     set = {{var="&update_col", value="%tslit(&update_val)"}};
	run;
%mend;

%updateCIQValue(form_key=LOCO_MMSE_NORTH_TWI_NTNL_2020_12_02, 
				question_key=loco_gage_1, 
				update_col=compliance, 
				update_val=1);

/* 
#######################################################
Approve a CIQ submission and move to final result table 
#######################################################
*/
%macro approveCIQSubmission(final_table=bnsf.CIQ_DATA_ENTRY_RESULTS, pending_table=bnsf.ciq_data_entry_results_pending, key_column=form_key, form_key=);
	
	data &final_table(append=yes);
		set &pending_table;
		where &key_column="&form_key";
	run;
	%deleteRows(caslib=%scan(&pending_table, 1, .), tablename=%scan(&pending_table, 2, .), key_column=&key_column, key_value=&form_key);
	
%mend;
%approveCIQSubmission(form_key=CAR_QTR_NORTH_MON_HVREC_2020_12_10);
/**
	This job backs up the CIQ assessments both approved and pending to disk
	Author: Matt Perry (matthew.perry@sas.com)
**/
cas;
caslib _all_ assign;

%let ciq_caslib=BNSF;

proc casutil; 
	save casout="CIQ_DATA_ENTRY_RESULTS" casdata="CIQ_DATA_ENTRY_RESULTS" incaslib="&ciq_caslib" outcaslib="&ciq_caslib" replace;
quit;

proc casutil; 
	save casout="CIQ_DATA_ENTRY_RESULTS_PENDING" casdata="CIQ_DATA_ENTRY_RESULTS_PENDING" incaslib="&ciq_caslib" outcaslib="&ciq_caslib" replace;
quit;
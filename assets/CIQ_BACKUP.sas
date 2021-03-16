/**
	Date:   3/16/2021
	Author: Matt Perry (matthew.perry@sas.com)
	Desc:   This job backs up the CIQ assessments every 15 minutes to disk
**/
cas;
caslib _all_ assign;

%let ciq_caslib=CIQ;

proc casutil; 
	save casout="CIQ_DATA_ENTRY_RESULTS" casdata="CIQ_DATA_ENTRY_RESULTS" incaslib="&ciq_caslib" outcaslib="&ciq_caslib" replace;
quit;
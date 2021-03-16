/**
	Date:   3/16/2021
	Author: Matt Perry (matthew.perry@sas.com)
	Desc:   This job backs performs a 30 day rolling backup of CIQ data
**/
cas;
caslib _all_ assign;

%let ciq_caslib=CIQ;
%let backup_number=%sysfunc(day(%sysfunc(today())), 12.);

proc casutil; 
	save casout="CIQ_DATA_ENTRY_RESULTS_&backup_number" 
	     casdata="CIQ_DATA_ENTRY_RESULTS" 
		 incaslib="&ciq_caslib" outcaslib="&ciq_caslib" replace;
quit;
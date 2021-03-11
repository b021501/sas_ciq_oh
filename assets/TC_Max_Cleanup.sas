cas;
caslib _all_ assign;

/* Drop search variable*/
data work.tc_max;
	set bnsf.tcmax_data;
	drop search;
run;

/* Remove dups */
proc sort data=work.tc_max out=work.tc_max_no_dups noduprecs;
	by _all_;
run;

/* Drop in memory table*/
proc casutil; 
	droptable incaslib="BNSF" casdata="tcmax_data" quiet;
quit;

/* Write back to memory with de-duped data */
data bnsf.tcmax_data(promote=yes);
	set work.tc_max_no_dups;
run;

/* Save to disk */
proc casutil; 
	save casout="tcmax_data" casdata="tcmax_data" incaslib="BNSF" outcaslib="BNSF" replace;
quit;

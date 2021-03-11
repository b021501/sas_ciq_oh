cas;
caslib _all_ assign;

/* List the distinct cmo, division, and stations*/
proc sql number;
	select distinct cmo, divison, station from bnsf.ADP_DATA order by cmo, divison, station;
quit;
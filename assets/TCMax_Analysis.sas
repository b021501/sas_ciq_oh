cas mySession sessopts=(caslib=BNSF);
caslib _all_ assign;

proc sql number;
	select distinct shopCode from bnsf.tcmax;
quit;

proc sql number;
	select distinct TCMax_Station_Cars from bnsf.adp_data;
quit;

proc sql;
	create table work.tcmax_temp as
	select  TCmax.*
	from bnsf.tcmax, bnsf.adp_data 
	where shopcode=TCMax_Station_Cars;
quit;

proc contents data=work.tcmax_temp;
run;

data bnsf.tcmax_data(promote=yes);
	set work.tcmax_temp;
run;

proc casutil; 
	save casout="tcmax_data" casdata="tcmax_data" incaslib="BNSF" outcaslib="BNSF" replace;
quit;

cas;
caslib _all_ assign;

data bnsf.adp_data(append=yes);
	length cmo $ 5; 
	length Divison $ 3; 
	length station  $ 13; 
	length TCMax_Station_Cars  $ 11; 
	length TCMax_Station_Loco $ 12; 

	cmo = "North";
	Divison = "HLA";
	station = "Havelock";
	TCMax_Station_Cars = "Havelock";
	TCMax_Station_Loco = "Havelock";
	output;

	cmo = "South";
	Divison = "KAN";
	station = "Topeka";
	TCMax_Station_Cars = "Topeka";
	TCMax_Station_Loco = "Topeka";
	output;

run;


proc casutil; 
	save casout="adp_data" casdata="adp_data" incaslib="BNSF" outcaslib="BNSF" replace;
quit;

/* proc sql; */
/* 	create table work.adp as */
/* 	select * from bnsf.adp_data; */
/* quit; */
/*  */
/* data bnsf.adp_data(promote=yes); */
/* 	set work.adp; */
/*  */
/* 	if station ne "Havelock" and station ne "Topeka"; */
/*  */
/* run; */
cas;
caslib _all_ assign;

data bnsf.assessors(append=yes);
	
	length name $ 100 assessment_type $ 4;
	name='Edward Rhoads';
	assessment_type='CIQ';
	output;
	name='Ryan Confair';
	assessment_type='MMSE';
	output;
	name='Dion Pacheco';
	assessment_type='MMSE';
	output;

run;

proc casutil; 
	save casout="assessors" casdata="assessors" incaslib="BNSF" outcaslib="BNSF" replace;
quit;
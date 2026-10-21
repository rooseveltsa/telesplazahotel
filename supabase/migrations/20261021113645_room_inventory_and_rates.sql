SET search_path TO teles, public;
UPDATE rooms SET category='Duplo',capacity=3,rate=29000,extra_guest_rate=5000 WHERE number IN ('101','102','103','104','105');
UPDATE rooms SET category='Casal',capacity=3,rate=28000,extra_guest_rate=5000 WHERE number IN ('106','107','108','109','110');
UPDATE daily_rates SET rate=29000,extra_guest_rate=5000,updated=to_char(now(),'YYYY-MM-DD"T"HH24:MI:SSZ') WHERE category='Duplo' AND day>='2026-10-05';
UPDATE daily_rates SET rate=28000,extra_guest_rate=5000,updated=to_char(now(),'YYYY-MM-DD"T"HH24:MI:SSZ') WHERE category='Casal' AND day>='2026-10-05';
RESET search_path;;

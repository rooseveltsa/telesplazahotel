-- Tarifa de Natal 2027 para Casal, gravada pela migration.
-- Serve também de sonda: se o site passar a cobrar este valor, a leitura do
-- tarifário está correta e qualquer falha está no caminho de escrita do painel.
SET search_path TO teles, public;

UPDATE teles.daily_rates d
   SET rate = 45000, updated = to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSZ')
  FROM teles.portal_config p
 WHERE p.id = 1
   AND d.hotel_id = p.hotel_id
   AND d.category = 'Casal'
   AND d.day BETWEEN '2027-12-20' AND '2027-12-26';

RESET search_path;

-- Aplicada em produção em 2026-10-21 16:52 UTC direto no banco; registrada aqui para o repositório representar a produção.
-- Quartos ímpares são Duplo (R$ 255) e pares são Casal (R$ 260). O preço do site vem do quarto (stayQuote em rates.ts);
-- daily_rates acompanha o mesmo valor e só restringe datas (fechado, mínimo de diárias).
-- Os cadastros inexistentes 1002, 1004 e 1006 foram excluídos na mesma data, junto com 3 reservas e 4 lançamentos vinculados.
SET search_path TO teles, public;
UPDATE rooms SET category=CASE WHEN number::int%2=1 THEN 'Duplo' ELSE 'Casal' END,
  rate=CASE WHEN number::int%2=1 THEN 25500 ELSE 26000 END
  WHERE number IN ('101','102','103','104','105','106','107','108','109','110');
UPDATE daily_rates SET rate=CASE category WHEN 'Duplo' THEN 25500 ELSE 26000 END,
  updated=to_char(now() AT TIME ZONE 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  WHERE category IN ('Duplo','Casal') AND day>='2026-10-21';
RESET search_path;

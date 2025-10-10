-- Creates a restricted RPC to execute SQL statements via PostgREST
-- Grant execute only to service_role

create or replace function public.exec_sql(sql_query text)
returns json
language plpgsql
security definer
as $$
declare
  res json;
begin
  -- Basic guardrails: disallow dangerous keywords (very naive)
  if position('drop database' in lower(sql_query)) > 0 then
    raise exception 'Forbidden statement';
  end if;

  begin
    execute sql_query;
    res := json_build_object('ok', true);
  exception when others then
    res := json_build_object('ok', false, 'error', SQLERRM);
  end;

  return res;
end;
$$;

revoke all on function public.exec_sql(text) from public;
grant execute on function public.exec_sql(text) to postgres;
grant execute on function public.exec_sql(text) to service_role;



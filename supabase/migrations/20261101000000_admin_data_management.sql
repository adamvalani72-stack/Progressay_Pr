revoke all on table public.orders,
  public.memberships,
  public.gift_cards,
  public.contact_messages,
  public.reviews,
  public.gaming_hub_accounts,
  public.gaming_hub_game_progress,
  public.gaming_hub_sessions
from public, anon, authenticated;

grant select, insert, update on table public.orders to service_role;
grant select, insert, update on table public.memberships to service_role;
grant select, insert, update on table public.gift_cards to service_role;
grant select, insert, delete on table public.contact_messages to service_role;
grant select, insert, update on table public.reviews to service_role;
grant select, insert, update, delete on table public.gaming_hub_accounts to service_role;
grant select, insert, update, delete on table public.gaming_hub_game_progress to service_role;
grant select, insert, delete on table public.gaming_hub_sessions to service_role;

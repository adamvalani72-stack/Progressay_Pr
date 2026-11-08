update public.products
set image_url = '/img/game%20image.jpg'
where image_url like '/img/portfolio/%-small.jpg';

update public.products
set image_url = '/img/Neon%20Gaming%20Hub%20Gift%20Card.png'
where slug in ('gaming-hub-gift-card', 'galactic-gift-card', 'royal-prestige-gift-card');
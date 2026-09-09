-- ==============================================================================
-- Migration: Update Blog Posts URLs to Supabase Cloud Storage (blog-images)
-- ==============================================================================


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/bacteriostatic-water-vs-sterile-water/image1.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/bacteriostatic-water-vs-sterile-water/image1.png')
WHERE content LIKE '%/blog-assets/bacteriostatic-water-vs-sterile-water/image1.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/bacteriostatic-water-vs-sterile-water/image1.png'
WHERE cover_image_url = '/blog-assets/bacteriostatic-water-vs-sterile-water/image1.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/bacteriostatic-water-vs-sterile-water/image2.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/bacteriostatic-water-vs-sterile-water/image2.png')
WHERE content LIKE '%/blog-assets/bacteriostatic-water-vs-sterile-water/image2.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/bacteriostatic-water-vs-sterile-water/image2.png'
WHERE cover_image_url = '/blog-assets/bacteriostatic-water-vs-sterile-water/image2.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/bacteriostatic-water-vs-sterile-water/image3.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/bacteriostatic-water-vs-sterile-water/image3.png')
WHERE content LIKE '%/blog-assets/bacteriostatic-water-vs-sterile-water/image3.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/bacteriostatic-water-vs-sterile-water/image3.png'
WHERE cover_image_url = '/blog-assets/bacteriostatic-water-vs-sterile-water/image3.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/bacteriostatic-water-vs-sterile-water/image4.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/bacteriostatic-water-vs-sterile-water/image4.png')
WHERE content LIKE '%/blog-assets/bacteriostatic-water-vs-sterile-water/image4.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/bacteriostatic-water-vs-sterile-water/image4.png'
WHERE cover_image_url = '/blog-assets/bacteriostatic-water-vs-sterile-water/image4.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/bacteriostatic-water-vs-sterile-water/image5.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/bacteriostatic-water-vs-sterile-water/image5.png')
WHERE content LIKE '%/blog-assets/bacteriostatic-water-vs-sterile-water/image5.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/bacteriostatic-water-vs-sterile-water/image5.png'
WHERE cover_image_url = '/blog-assets/bacteriostatic-water-vs-sterile-water/image5.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/how-long-does-bacteriostatic-water-last/image1.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-long-does-bacteriostatic-water-last/image1.png')
WHERE content LIKE '%/blog-assets/how-long-does-bacteriostatic-water-last/image1.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-long-does-bacteriostatic-water-last/image1.png'
WHERE cover_image_url = '/blog-assets/how-long-does-bacteriostatic-water-last/image1.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/how-long-does-bacteriostatic-water-last/image2.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-long-does-bacteriostatic-water-last/image2.png')
WHERE content LIKE '%/blog-assets/how-long-does-bacteriostatic-water-last/image2.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-long-does-bacteriostatic-water-last/image2.png'
WHERE cover_image_url = '/blog-assets/how-long-does-bacteriostatic-water-last/image2.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/how-long-does-bacteriostatic-water-last/image3.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-long-does-bacteriostatic-water-last/image3.png')
WHERE content LIKE '%/blog-assets/how-long-does-bacteriostatic-water-last/image3.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-long-does-bacteriostatic-water-last/image3.png'
WHERE cover_image_url = '/blog-assets/how-long-does-bacteriostatic-water-last/image3.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/how-long-does-bacteriostatic-water-last/image4.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-long-does-bacteriostatic-water-last/image4.png')
WHERE content LIKE '%/blog-assets/how-long-does-bacteriostatic-water-last/image4.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-long-does-bacteriostatic-water-last/image4.png'
WHERE cover_image_url = '/blog-assets/how-long-does-bacteriostatic-water-last/image4.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/how-long-does-bacteriostatic-water-last/image5.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-long-does-bacteriostatic-water-last/image5.png')
WHERE content LIKE '%/blog-assets/how-long-does-bacteriostatic-water-last/image5.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-long-does-bacteriostatic-water-last/image5.png'
WHERE cover_image_url = '/blog-assets/how-long-does-bacteriostatic-water-last/image5.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/how-long-does-bacteriostatic-water-last/image6.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-long-does-bacteriostatic-water-last/image6.png')
WHERE content LIKE '%/blog-assets/how-long-does-bacteriostatic-water-last/image6.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-long-does-bacteriostatic-water-last/image6.png'
WHERE cover_image_url = '/blog-assets/how-long-does-bacteriostatic-water-last/image6.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/how-to-store-bacteriostatic-water/image1.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-to-store-bacteriostatic-water/image1.png')
WHERE content LIKE '%/blog-assets/how-to-store-bacteriostatic-water/image1.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-to-store-bacteriostatic-water/image1.png'
WHERE cover_image_url = '/blog-assets/how-to-store-bacteriostatic-water/image1.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/how-to-store-bacteriostatic-water/image2.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-to-store-bacteriostatic-water/image2.png')
WHERE content LIKE '%/blog-assets/how-to-store-bacteriostatic-water/image2.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-to-store-bacteriostatic-water/image2.png'
WHERE cover_image_url = '/blog-assets/how-to-store-bacteriostatic-water/image2.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/how-to-store-bacteriostatic-water/image3.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-to-store-bacteriostatic-water/image3.png')
WHERE content LIKE '%/blog-assets/how-to-store-bacteriostatic-water/image3.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-to-store-bacteriostatic-water/image3.png'
WHERE cover_image_url = '/blog-assets/how-to-store-bacteriostatic-water/image3.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/how-to-store-bacteriostatic-water/image4.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-to-store-bacteriostatic-water/image4.png')
WHERE content LIKE '%/blog-assets/how-to-store-bacteriostatic-water/image4.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-to-store-bacteriostatic-water/image4.png'
WHERE cover_image_url = '/blog-assets/how-to-store-bacteriostatic-water/image4.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/how-to-store-bacteriostatic-water/image5.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-to-store-bacteriostatic-water/image5.png')
WHERE content LIKE '%/blog-assets/how-to-store-bacteriostatic-water/image5.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-to-store-bacteriostatic-water/image5.png'
WHERE cover_image_url = '/blog-assets/how-to-store-bacteriostatic-water/image5.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/how-to-store-bacteriostatic-water/image6.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-to-store-bacteriostatic-water/image6.png')
WHERE content LIKE '%/blog-assets/how-to-store-bacteriostatic-water/image6.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/how-to-store-bacteriostatic-water/image6.png'
WHERE cover_image_url = '/blog-assets/how-to-store-bacteriostatic-water/image6.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/what-is-bacteriostatic-water/image1.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water/image1.png')
WHERE content LIKE '%/blog-assets/what-is-bacteriostatic-water/image1.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water/image1.png'
WHERE cover_image_url = '/blog-assets/what-is-bacteriostatic-water/image1.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/what-is-bacteriostatic-water/image2.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water/image2.png')
WHERE content LIKE '%/blog-assets/what-is-bacteriostatic-water/image2.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water/image2.png'
WHERE cover_image_url = '/blog-assets/what-is-bacteriostatic-water/image2.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/what-is-bacteriostatic-water/image3.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water/image3.png')
WHERE content LIKE '%/blog-assets/what-is-bacteriostatic-water/image3.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water/image3.png'
WHERE cover_image_url = '/blog-assets/what-is-bacteriostatic-water/image3.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/what-is-bacteriostatic-water/image4.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water/image4.png')
WHERE content LIKE '%/blog-assets/what-is-bacteriostatic-water/image4.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water/image4.png'
WHERE cover_image_url = '/blog-assets/what-is-bacteriostatic-water/image4.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/what-is-bacteriostatic-water/image5.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water/image5.png')
WHERE content LIKE '%/blog-assets/what-is-bacteriostatic-water/image5.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water/image5.png'
WHERE cover_image_url = '/blog-assets/what-is-bacteriostatic-water/image5.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/what-is-bacteriostatic-water/image6.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water/image6.png')
WHERE content LIKE '%/blog-assets/what-is-bacteriostatic-water/image6.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water/image6.png'
WHERE cover_image_url = '/blog-assets/what-is-bacteriostatic-water/image6.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/what-is-bacteriostatic-water-used-for/image1.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water-used-for/image1.png')
WHERE content LIKE '%/blog-assets/what-is-bacteriostatic-water-used-for/image1.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water-used-for/image1.png'
WHERE cover_image_url = '/blog-assets/what-is-bacteriostatic-water-used-for/image1.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/what-is-bacteriostatic-water-used-for/image2.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water-used-for/image2.png')
WHERE content LIKE '%/blog-assets/what-is-bacteriostatic-water-used-for/image2.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water-used-for/image2.png'
WHERE cover_image_url = '/blog-assets/what-is-bacteriostatic-water-used-for/image2.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/what-is-bacteriostatic-water-used-for/image3.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water-used-for/image3.png')
WHERE content LIKE '%/blog-assets/what-is-bacteriostatic-water-used-for/image3.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water-used-for/image3.png'
WHERE cover_image_url = '/blog-assets/what-is-bacteriostatic-water-used-for/image3.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/what-is-bacteriostatic-water-used-for/image4.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water-used-for/image4.png')
WHERE content LIKE '%/blog-assets/what-is-bacteriostatic-water-used-for/image4.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water-used-for/image4.png'
WHERE cover_image_url = '/blog-assets/what-is-bacteriostatic-water-used-for/image4.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/what-is-bacteriostatic-water-used-for/image5.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water-used-for/image5.png')
WHERE content LIKE '%/blog-assets/what-is-bacteriostatic-water-used-for/image5.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water-used-for/image5.png'
WHERE cover_image_url = '/blog-assets/what-is-bacteriostatic-water-used-for/image5.png';


UPDATE public.blog_posts 
SET content = REPLACE(content, '/blog-assets/what-is-bacteriostatic-water-used-for/image6.png', 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water-used-for/image6.png')
WHERE content LIKE '%/blog-assets/what-is-bacteriostatic-water-used-for/image6.png%';


UPDATE public.blog_posts 
SET cover_image_url = 'https://gtmpqjbbcobjxwfeyqzz.supabase.co/storage/v1/object/public/blog-images/what-is-bacteriostatic-water-used-for/image6.png'
WHERE cover_image_url = '/blog-assets/what-is-bacteriostatic-water-used-for/image6.png';

ALTER TABLE "public"."products" 
ADD COLUMN "price" numeric DEFAULT 0,
ADD COLUMN "image_url" text,
ADD COLUMN "category" text,
ADD COLUMN "stock_quantity" integer DEFAULT 0;

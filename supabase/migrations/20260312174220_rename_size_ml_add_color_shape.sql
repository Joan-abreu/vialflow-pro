ALTER TABLE "public"."vial_types" RENAME COLUMN "size_ml" TO "capacity_ml";
ALTER TABLE "public"."vial_types" ADD COLUMN "color" text;
ALTER TABLE "public"."vial_types" ADD COLUMN "shape" text;

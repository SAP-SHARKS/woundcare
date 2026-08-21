/* Align legacy columns with the current patient/wound episode form model. */
ALTER TABLE public.patients ALTER COLUMN wound_type SET DEFAULT 'other';
ALTER TABLE public.patients ALTER COLUMN onset_date SET DEFAULT CURRENT_DATE;
UPDATE public.profiles p SET email=u.email FROM auth.users u WHERE p.id=u.id AND COALESCE(p.email,'')='';
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
BEGIN
  INSERT INTO public.profiles(id,role,display_name,email) VALUES(NEW.id,'patient',COALESCE(NEW.raw_user_meta_data->>'display_name',''),COALESCE(NEW.email,'')) ON CONFLICT(id) DO NOTHING;
  NEW.raw_app_meta_data:=COALESCE(NEW.raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('role','patient');
  NEW.raw_user_meta_data:=COALESCE(NEW.raw_user_meta_data,'{}'::jsonb)-'role';
  RETURN NEW;
END; $$;

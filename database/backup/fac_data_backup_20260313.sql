--
-- PostgreSQL database dump
--

-- Dumped from database version 15.4 (Debian 15.4-1.pgdg110+1)
-- Dumped by pg_dump version 15.4 (Debian 15.4-1.pgdg110+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: lands; Type: TABLE DATA; Schema: public; Owner: fac_admin
--

INSERT INTO public.lands (id, name, type, area, admin_region, geom, created_at) VALUES (1, '龙华商业中心', '商业用地', 120000, '龙华区', '0103000020E61000000100000005000000E17A14AE47815C4085EB51B81EA5364052B81E85EB815C4085EB51B81EA5364052B81E85EB815C4048E17A14AEA73640E17A14AE47815C4048E17A14AEA73640E17A14AE47815C4085EB51B81EA53640', '2026-03-13 07:10:52.922985');
INSERT INTO public.lands (id, name, type, area, admin_region, geom, created_at) VALUES (2, '龙悦居三期', '居住用地', 20000, '龙华区', '0103000020E61000000100000005000000594C0B2395815C40D40DDD98949A3640AC876107A2815C40B8A2191F559A36400E4CA2B4CC815C4084CA482AB89A364024238AD0C3815C40A013D2560B9B3640594C0B2395815C40D40DDD98949A3640', '2026-03-13 07:11:56.656094');
INSERT INTO public.lands (id, name, type, area, admin_region, geom, created_at) VALUES (3, '白石龙音乐公园', '公园绿地', 50000, '龙华区', '0103000020E61000000100000009000000F8343E7AFD815C407451AE72019A3640711A84AF03825C403016F387D299364025E9A1DC06825C405CA54CB2749936409F3C8AFA11825C40B4EF5CEB2F9936407453468028825C40D451CCAA03993640F0F0155842825C40001CC1CC059936402C001ADB57825C407C97EA2D44993640D320A7340B825C40BCC36100839A3640F8343E7AFD815C407451AE72019A3640', '2026-03-13 07:12:32.423698');


--
-- Data for Name: points; Type: TABLE DATA; Schema: public; Owner: fac_admin
--

INSERT INTO public.points (id, name, type, address, capacity, admin_region, geom, created_at) VALUES (1, '龙华中学', '学校', '龙华区公园路1号', 2500, '龙华区', '0101000020E610000052B81E85EB815C40EC51B81E85AB3640', '2026-03-13 07:10:52.915751');
INSERT INTO public.points (id, name, type, address, capacity, admin_region, geom, created_at) VALUES (2, '深圳外国语学校龙华校区', '学校', '深圳北站附近', 50000, '龙华区', '0101000020E6100000F16E9AC6BF815C40CCB8968A489A3640', '2026-03-13 07:13:14.089287');


--
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: fac_admin
--



--
-- Name: lands_id_seq; Type: SEQUENCE SET; Schema: public; Owner: fac_admin
--

SELECT pg_catalog.setval('public.lands_id_seq', 3, true);


--
-- Name: points_id_seq; Type: SEQUENCE SET; Schema: public; Owner: fac_admin
--

SELECT pg_catalog.setval('public.points_id_seq', 2, true);


--
-- PostgreSQL database dump complete
--



import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lweiutdbssdjltphimyo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZWl1dGRic3Nkamx0cGhpbXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDkyMjEsImV4cCI6MjA4NDk4NTIyMX0.Q9Kn5AFT6VnyNXcvkTUo_3rpzHv9SOfgChfLxbZRGpo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

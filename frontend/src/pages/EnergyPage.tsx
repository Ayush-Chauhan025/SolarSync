import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { MapPin, Save, Sun } from 'lucide-react'
import SectionTitle from '../components/SectionTitle'
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState'
import { useHomes } from '../home/useHomes'
import { apiRequest } from '../lib/api'
import type { HomeEnergy, HomeItem, PanelDirection } from '../types'

const directionOptions: PanelDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export default function EnergyPage() {
  const { activeHome, loading, error: homesError, refresh, addHome, updateHome } = useHomes()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  useEffect(() => {
    setError('')
    setSaved(false)
  }, [activeHome?.home_id])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaved(false)
    setSaving(true)
    const form = new FormData(event.currentTarget)
    const hourlyDemand = Array.from({ length: 24 }, (_, hour) => Number(form.get(`demand-${hour}`)))
    if (hourlyDemand.some((value) => !Number.isFinite(value) || value < 0)) {
      setError('Enter a valid non-negative demand value for every hour.')
      setSaving(false)
      return
    }
    const settings: HomeEnergy = {
      location: {
        latitude: Number(form.get('latitude')),
        longitude: Number(form.get('longitude')),
        timezone: String(form.get('timezone')),
      },
      solar_system: {
        rated_capacity_kwp: Number(form.get('rated_capacity_kwp')),
        panel_tilt_degrees: Number(form.get('panel_tilt_degrees')),
        panel_direction: String(form.get('panel_direction')) as PanelDirection,
        max_inverter_output_kw: Number(form.get('max_inverter_output_kw')),
        system_performance_ratio: form.get('system_performance_ratio') ? Number(form.get('system_performance_ratio')) : null,
      },
      electricity: {
        baseline_demand_kw: hourlyDemand.flatMap((value) => [value, value]),
        max_total_load_kw: Number(form.get('max_total_load_kw')),
      },
      grid_connection: {
        max_import_kw: Number(form.get('max_import_kw')),
        max_export_kw: Number(form.get('max_export_kw')),
      },
      grid_tariffs: [{
        start_minute: 0,
        end_minute: 1440,
        import_rate_inr_per_kwh: Number(form.get('import_rate_inr_per_kwh')),
        export_credit_inr_per_kwh: Number(form.get('export_credit_inr_per_kwh')),
      }],
    }

    try {
      if (activeHome) {
        const result = await apiRequest<{ status: 'ok'; body: HomeItem }>(`/homes/${activeHome.home_id}`, { method: 'PUT', body: JSON.stringify(settings) })
        updateHome(result.body)
      } else {
        const result = await apiRequest<{ status: 'ok'; body: HomeItem }>('/homes', { method: 'POST', body: JSON.stringify(settings) })
        addHome(result.body)
      }
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your home profile.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState label="Loading your home profile…" />
  if (homesError) return <ErrorState message={homesError} onRetry={() => void refresh()} />

  const settings = activeHome?.settings
  return (
    <section className="profile-form-page">
      <SectionTitle eyebrow="YOUR HOME" title={activeHome ? 'Energy profile' : 'Set up your home'} description="Enter your solar system, household demand, and grid settings. SolarSync uses these values to estimate the day's energy plan." />
      {!activeHome && <div className="form-info"><MapPin size={16} /><p>This profile is saved to your account and can be updated whenever your system changes.</p></div>}
      {error && <ErrorState message={error} />}
      {saved && <div className="form-alert success-state" role="status">Your home energy profile has been saved.</div>}
      <form className="profile-form" key={activeHome?.home_id ?? 'new-home'} onSubmit={saveProfile}>
        <fieldset className="form-section">
          <legend><MapPin size={16} />Location</legend>
          <p className="form-section-help">Coordinates and timezone are used to request the right solar forecast.</p>
          <div className="form-grid three-columns">
            <label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90" defaultValue={settings?.location.latitude ?? ''} required /></label>
            <label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180" defaultValue={settings?.location.longitude ?? ''} required /></label>
            <label>Timezone<input name="timezone" type="text" defaultValue={settings?.location.timezone ?? timezone} placeholder="Asia/Kolkata" required /></label>
          </div>
        </fieldset>
        <fieldset className="form-section">
          <legend><Sun size={16} />Solar system</legend>
          <div className="form-grid three-columns">
            <label>Installed capacity (kWp)<input name="rated_capacity_kwp" type="number" step="0.1" min="0.1" defaultValue={settings?.solar_system.rated_capacity_kwp ?? ''} required /></label>
            <label>Inverter output limit (kW)<input name="max_inverter_output_kw" type="number" step="0.1" min="0.1" defaultValue={settings?.solar_system.max_inverter_output_kw ?? ''} required /></label>
            <label>Panel tilt (degrees)<input name="panel_tilt_degrees" type="number" step="1" min="0" max="90" defaultValue={settings?.solar_system.panel_tilt_degrees ?? ''} required /></label>
            <label>Panel direction<select name="panel_direction" defaultValue={settings?.solar_system.panel_direction ?? ''} required><option value="" disabled>Select direction</option>{directionOptions.map((direction) => <option key={direction} value={direction}>{direction}</option>)}</select></label>
            <label>System performance ratio<input name="system_performance_ratio" type="number" step="0.01" min="0.01" max="1" defaultValue={settings?.solar_system.system_performance_ratio ?? ''} placeholder="Optional, e.g. 0.8" /></label>
          </div>
        </fieldset>
        <fieldset className="form-section">
          <legend>Household demand</legend>
          <p className="form-section-help">Enter average demand for each hour. Each value is applied to both 30-minute intervals in that hour.</p>
          <div className="hourly-demand-grid">
            {Array.from({ length: 24 }, (_, hour) => {
              const value = settings?.electricity.baseline_demand_kw[hour * 2]
              return <label key={hour}><span>{String(hour).padStart(2, '0')}:00</span><input name={`demand-${hour}`} type="number" aria-label={`Baseline demand at ${String(hour).padStart(2, '0')}:00 in kW`} step="0.01" min="0" defaultValue={value ?? ''} required /></label>
            })}
          </div>
          <div className="form-grid three-columns demand-limits">
            <label>Maximum total load (kW)<input name="max_total_load_kw" type="number" step="0.1" min="0.1" defaultValue={settings?.electricity.max_total_load_kw ?? ''} required /></label>
            <label>Grid import limit (kW)<input name="max_import_kw" type="number" step="0.1" min="0.1" defaultValue={settings?.grid_connection.max_import_kw ?? ''} required /></label>
            <label>Grid export limit (kW)<input name="max_export_kw" type="number" step="0.1" min="0" defaultValue={settings?.grid_connection.max_export_kw ?? ''} required /></label>
          </div>
        </fieldset>
        <fieldset className="form-section">
          <legend>Grid rates</legend>
          <p className="form-section-help">These rates apply throughout the day. This profile editor currently supports one all-day import and export rate.</p>
          <div className="form-grid two-columns">
            <label>Import price (₹ / kWh)<input name="import_rate_inr_per_kwh" type="number" step="0.01" min="0" defaultValue={settings?.grid_tariffs[0]?.import_rate_inr_per_kwh ?? ''} required /></label>
            <label>Export credit (₹ / kWh)<input name="export_credit_inr_per_kwh" type="number" step="0.01" min="0" defaultValue={settings?.grid_tariffs[0]?.export_credit_inr_per_kwh ?? ''} required /></label>
          </div>
        </fieldset>
        <div className="form-actions"><span>All values are saved to your signed-in account.</span><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : <><Save size={15} />Save energy profile</>}</button></div>
      </form>
      {activeHome && <EmptyState title="Forecasts use your latest profile" description="Changes take effect the next time you create or preview a schedule." />}
    </section>
  )
}

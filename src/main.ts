import './styles.css'
import { registerSW } from 'virtual:pwa-register'
import { App } from './ui/app'

const root = document.querySelector<HTMLDivElement>('#app')
if (!root) throw new Error('Falta el contenedor #app')

const app = new App(root)
void app.start()

registerSW({ immediate: true })

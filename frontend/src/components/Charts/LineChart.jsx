import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const LineChart = ({ 
 title = 'Line Chart',
 labels = [], 
 datasets = [],
 options = {},
 height = 400
}) => {
 const defaultOptions = {
 responsive: true,
 maintainAspectRatio: false,
 plugins: {
 legend: {
 position: 'top',
 },
 title: {
 display: true,
 text: title,
 font: {
 size: 16,
 weight: 'bold',
 },
 },
 },
 scales: {
 y: {
 beginAtZero: true,
 },
 },
 };

 const chartData = {
 labels,
 datasets: datasets.map((dataset, index) => ({
 label: dataset.label || `Dataset ${index + 1}`,
 data: dataset.data || [],
 borderColor: dataset.borderColor || `hsl(${index * 60}, 70%, 60%)`,
 backgroundColor: dataset.backgroundColor || `hsl(${index * 60}, 70%, 90%)`,
 tension: 0.4,
 fill: dataset.fill !== undefined ? dataset.fill : false,
 ...dataset,
 })),
 };

 return (
 <div style={{ position: 'relative', height: `${height}px`, width: '100%' }}>
 <Line data={chartData} options={{ ...defaultOptions, ...options }} />
 </div>
 );
};

export default LineChart;

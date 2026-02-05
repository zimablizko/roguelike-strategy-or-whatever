import { Component } from 'excalibur';

/**
 * Component for storing position data
 */
export class PositionComponent extends Component {
  constructor(
    public x: number,
    public y: number,
  ) {
    super();
  }
}
